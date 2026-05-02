import { PrismaClient } from '@prisma/client';
import { replyToComment, reactToComment, sendText } from './lib/facebook';
import { pickReplyByCategory, detectCommentCategory } from './lib/comment-filter';
import { erpCreateOrder } from './lib/erp';
import { getBotMessage } from './lib/bot-messages';

const prisma = new PrismaClient();
const POLL_INTERVAL_MS = 5000;
const REMINDER_POLL_INTERVAL_MS = 60_000;
const RETRY_POLL_INTERVAL_MS = 2 * 60_000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const REMINDER_1_DELAY_MS = 1 * ONE_HOUR_MS;
const REMINDER_23_DELAY_MS = 23 * ONE_HOUR_MS;
const FACEBOOK_WINDOW_MS = 24 * ONE_HOUR_MS;
const FACEBOOK_SAFE_CUTOFF_MS = 23.5 * ONE_HOUR_MS;
const PHONE_FOLLOWUP_DELAY_MS = 30 * 60 * 1000;
const INTENT_FOLLOWUP_DELAY_MS = 60 * 60 * 1000;
const MAX_ORDER_RETRY = 3;

const PEAK_HOURLY_LIMIT = 40;
const OFFPEAK_HOURLY_LIMIT = 50;
const PEAK_DELAY_MIN_MS = 45_000;
const PEAK_DELAY_MAX_MS = 120_000;
const OFFPEAK_DELAY_MIN_MS = 30_000;
const OFFPEAK_DELAY_MAX_MS = 90_000;
const SAME_PAGE_COOLDOWN_MS = 2 * 60_000;
const PER_PAGE_DAILY_LIMIT = 500;
const GLOBAL_DAILY_LIMIT = 15_000;

const lastReplyByPage = new Map<string, number>();
let lastRepliedPageId: string | null = null;
let nextAllowedSendAt = 0;

type TrafficWindow = 'peak' | 'offpeak' | 'night';

function currentWindow(): TrafficWindow {
  const h = new Date().getHours();
  if (h >= 22 || h < 8) return 'night';
  if (h >= 10 && h < 16) return 'peak';
  return 'offpeak';
}

function isOrderPeakHour(): boolean {
  // Based on real data: 10:00-11:00 MN is peak order time (335 orders).
  // Deprioritize comment replies so messenger gets responded to faster.
  const h = new Date().getHours();
  return h === 10;
}

function windowLimits(w: TrafficWindow): { hourly: number; minDelay: number; maxDelay: number } {
  if (isOrderPeakHour()) {
    return { hourly: Math.floor(PEAK_HOURLY_LIMIT / 2), minDelay: PEAK_DELAY_MAX_MS, maxDelay: PEAK_DELAY_MAX_MS * 2 };
  }
  if (w === 'peak') return { hourly: PEAK_HOURLY_LIMIT, minDelay: PEAK_DELAY_MIN_MS, maxDelay: PEAK_DELAY_MAX_MS };
  return { hourly: OFFPEAK_HOURLY_LIMIT, minDelay: OFFPEAK_DELAY_MIN_MS, maxDelay: OFFPEAK_DELAY_MAX_MS };
}

function randomDelay(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min));
}

function nextMorning8(): Date {
  const d = new Date();
  if (d.getHours() >= 8 && d.getHours() < 22) return d;
  const next = new Date(d);
  if (d.getHours() >= 22) next.setDate(d.getDate() + 1);
  next.setHours(8, 0, 0, 0);
  return next;
}

async function getSetting(key: string, fallback: string): Promise<string> {
  const s = await prisma.setting.findUnique({ where: { key } });
  return s?.value ?? fallback;
}

async function isNightMode(): Promise<boolean> {
  const enabled = (await getSetting('night_mode_enabled', 'true')) === 'true';
  if (!enabled) return false;
  const start = parseInt(await getSetting('night_start_hour', '22'), 10);
  const end = parseInt(await getSetting('night_end_hour', '8'), 10);
  const h = new Date().getHours();
  if (start > end) return h >= start || h < end;
  return h >= start && h < end;
}

async function processOne() {
  const botEnabled = (await getSetting('bot_enabled', 'true')) === 'true';
  if (!botEnabled) return;

  const window = currentWindow();
  if (window === 'night' || (await isNightMode())) {
    await prisma.commentLead.updateMany({
      where: { status: 'queued', OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }] },
      data: { scheduledFor: nextMorning8() },
    });
    return;
  }

  const nowMs = Date.now();
  if (nowMs < nextAllowedSendAt) return;

  const now = new Date();
  const hourAgo = new Date(nowMs - ONE_HOUR_MS);
  const dayAgo = new Date(nowMs - 24 * ONE_HOUR_MS);

  const globalSentToday = await prisma.commentLead.count({
    where: { status: 'sent', sentAt: { gte: dayAgo } },
  });
  if (globalSentToday >= GLOBAL_DAILY_LIMIT) {
    await prisma.commentLead.updateMany({
      where: { status: 'queued', OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }] },
      data: { scheduledFor: new Date(nowMs + ONE_HOUR_MS) },
    });
    return;
  }

  const limits = windowLimits(window);

  const queued = await prisma.commentLead.findMany({
    where: { status: 'queued', OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }] },
    orderBy: { scheduledFor: 'asc' },
    take: 50,
  });
  if (queued.length === 0) return;

  let candidate: typeof queued[number] | null = null;
  // Primary: never pick same page as the most recently replied one and enforce cooldown.
  for (const c of queued) {
    if (c.pageId === lastRepliedPageId) continue;
    const last = lastReplyByPage.get(c.pageId) ?? 0;
    if (nowMs - last < SAME_PAGE_COOLDOWN_MS) continue;
    candidate = c;
    break;
  }
  // Fallback: still enforce "not the same page as the previous reply" — never allow
  // consecutive same-page sends.
  if (!candidate) {
    for (const c of queued) {
      if (c.pageId === lastRepliedPageId) continue;
      const last = lastReplyByPage.get(c.pageId) ?? 0;
      if (nowMs - last < SAME_PAGE_COOLDOWN_MS) continue;
      candidate = c;
      break;
    }
  }
  if (!candidate) return;

  const page = await prisma.facebookPage.findUnique({ where: { pageId: candidate.pageId } });
  if (!page || !page.isActive || !page.autoReplyEnabled) {
    await prisma.commentLead.update({ where: { id: candidate.id }, data: { status: 'skipped' } });
    return;
  }

  const sentToday = await prisma.commentLead.count({
    where: { pageId: page.pageId, status: 'sent', sentAt: { gte: dayAgo } },
  });
  if (sentToday >= PER_PAGE_DAILY_LIMIT) {
    await prisma.commentLead.update({
      where: { id: candidate.id },
      data: { scheduledFor: new Date(nowMs + ONE_HOUR_MS) },
    });
    return;
  }

  const sentThisHour = await prisma.commentLead.count({
    where: { pageId: page.pageId, status: 'sent', sentAt: { gte: hourAgo } },
  });
  const pageLimit = Math.min(page.hourlyCommentLimit, limits.hourly);
  if (sentThisHour >= pageLimit) {
    await prisma.commentLead.update({
      where: { id: candidate.id },
      data: { scheduledFor: new Date(nowMs + ONE_HOUR_MS) },
    });
    return;
  }

  const replies = await prisma.commentReply.findMany({ where: { isActive: true } });
  const detected = detectCommentCategory(candidate.commentText);
  const productHint = candidate.productCode || '';
  const category = detected === 'interest' && !productHint ? 'interest' : productHint ? 'product' : 'interest';
  const replyText = pickReplyByCategory(
    replies.map((r) => ({ text: r.text, category: (r as any).category ?? 'generic' })),
    category,
    candidate.senderName || undefined,
    productHint || undefined,
  );

  const ok = await replyToComment(page.accessToken, candidate.commentId, replyText);

  if (page.reactionEnabled) {
    await reactToComment(page.accessToken, candidate.commentId).catch(() => false);
  }

  await prisma.commentLead.update({
    where: { id: candidate.id },
    data: {
      status: ok ? 'sent' : 'failed',
      replied: ok,
      repliedAt: ok ? new Date() : null,
      sentAt: ok ? new Date() : null,
      replyText,
    },
  });

  if (ok) {
    lastRepliedPageId = page.pageId;
    lastReplyByPage.set(page.pageId, Date.now());
    nextAllowedSendAt = Date.now() + randomDelay(limits.minDelay, limits.maxDelay);
  }

  console.log(`[queue] ${ok ? 'sent' : 'failed'} reply to ${candidate.commentId} (${page.pageName}) window=${window}`);
}

async function processReminders() {
  const botEnabled = (await getSetting('bot_enabled', 'true')) === 'true';
  if (!botEnabled) return;
  if (await isNightMode()) return;

  const now = Date.now();
  const abandoned = await prisma.conversation.findMany({
    where: {
      abandonedAt: { not: null },
      state: 'CONFIRM',
      isOperatorHandoff: false,
    },
    include: { page: true },
    take: 50,
  });

  for (const conv of abandoned) {
    if (!conv.abandonedAt) continue;
    const age = now - conv.abandonedAt.getTime();

    if (age >= FACEBOOK_WINDOW_MS) {
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { abandonedAt: null },
      });
      continue;
    }

    if (!conv.page?.isActive || !conv.page?.accessToken) continue;

    if (age >= REMINDER_23_DELAY_MS && !conv.reminder23SentAt && age < FACEBOOK_SAFE_CUTOFF_MS) {
      const ok = await sendText(
        conv.page.accessToken,
        conv.psid,
        'Таны захиалга дуусаагүй байна. Баталгаажуулахыг хүсвэл "Тийм" гэж бичнэ үү, эсвэл "Болих" гэж хариулна уу.',
        ['Тийм', 'Болих'],
      ).catch(() => false);
      if (ok) {
        await prisma.message.create({
          data: {
            conversationId: conv.id,
            text: 'Таны захиалга дуусаагүй байна. Баталгаажуулахыг хүсвэл "Тийм" гэж бичнэ үү, эсвэл "Болих" гэж хариулна уу.',
            isFromBot: true,
          },
        });
        await prisma.conversation.update({
          where: { id: conv.id },
          data: { reminder23SentAt: new Date() },
        });
        console.log(`[reminder] 23h sent to ${conv.psid}`);
      }
      continue;
    }

    if (age >= REMINDER_1_DELAY_MS && !conv.reminder1SentAt) {
      const ok = await sendText(
        conv.page.accessToken,
        conv.psid,
        'Сайн байна уу, таны захиалга баталгаажаагүй байна. Үргэлжлүүлэх үү?',
        ['Тийм', 'Болих'],
      ).catch(() => false);
      if (ok) {
        await prisma.message.create({
          data: {
            conversationId: conv.id,
            text: 'Сайн байна уу, таны захиалга баталгаажаагүй байна. Үргэлжлүүлэх үү?',
            isFromBot: true,
          },
        });
        await prisma.conversation.update({
          where: { id: conv.id },
          data: { reminder1SentAt: new Date() },
        });
        console.log(`[reminder] 1h sent to ${conv.psid}`);
      }
    }
  }
}

async function processAbandonedFollowups() {
  const botEnabled = (await getSetting('bot_enabled', 'true')) === 'true';
  if (!botEnabled) return;
  if (await isNightMode()) return;

  const now = Date.now();
  const cutoffPhone = new Date(now - PHONE_FOLLOWUP_DELAY_MS);
  const cutoffIntent = new Date(now - INTENT_FOLLOWUP_DELAY_MS);
  const windowCutoff = new Date(now - FACEBOOK_SAFE_CUTOFF_MS);

  const phoneStuck = await prisma.conversation.findMany({
    where: {
      phoneFollowupSentAt: null,
      isOperatorHandoff: false,
      state: { in: ['PHONE', 'EXTRA_PHONE', 'PROVINCE', 'DISTRICT'] },
      lastMessageAt: { lte: cutoffPhone, gte: windowCutoff },
    },
    include: { page: true },
    take: 30,
  });

  for (const conv of phoneStuck) {
    if (!conv.page?.isActive || !conv.page?.accessToken) continue;
    const ctx = (conv.context as any) || {};
    if (!ctx.phone) continue;
    if (ctx.address) continue;

    const msg = 'Сайн байна уу! 😊\nХаягаа бичвэл захиалгыг бүртгэж өгнө 📍\n(Дүүрэг, хороо, байр, тоот)';
    const ok = await sendText(conv.page.accessToken, conv.psid, msg).catch(() => false);
    if (ok) {
      await prisma.message.create({ data: { conversationId: conv.id, text: msg, isFromBot: true } });
      await prisma.conversation.update({ where: { id: conv.id }, data: { phoneFollowupSentAt: new Date() } });
      console.log(`[followup] phone->address nudge to ${conv.psid}`);
    }
  }

  const intentStuck = await prisma.conversation.findMany({
    where: {
      intentFollowupSentAt: null,
      isOperatorHandoff: false,
      state: 'PRODUCT',
      lastMessageAt: { lte: cutoffIntent, gte: windowCutoff },
    },
    include: { page: true },
    take: 30,
  });

  for (const conv of intentStuck) {
    if (!conv.page?.isActive || !conv.page?.accessToken) continue;
    const ctx = (conv.context as any) || {};
    if (ctx.selectedProduct) continue;
    const cart = (conv.cart as any[]) || [];
    if (cart.length > 0) continue;

    const msg = 'Сайн байна уу! 😊\nЯмар бараа авахыг хүсч байна вэ?\nБүтээгдэхүүний код эсвэл нэрийг бичнэ үү.';
    const ok = await sendText(conv.page.accessToken, conv.psid, msg).catch(() => false);
    if (ok) {
      await prisma.message.create({ data: { conversationId: conv.id, text: msg, isFromBot: true } });
      await prisma.conversation.update({ where: { id: conv.id }, data: { intentFollowupSentAt: new Date() } });
      console.log(`[followup] intent->product nudge to ${conv.psid}`);
    }
  }
}

async function processOrderRetries() {
  const failed = await prisma.order.findMany({
    where: {
      status: 'failed',
      retryCount: { lt: MAX_ORDER_RETRY },
    },
    include: { erpConfig: true },
    take: 20,
  });

  for (const order of failed) {
    if (!order.erpConfig) continue;
    const products = (order.products as any[]).map((p) => ({
      productId: String(p.productId ?? p.id),
      productName: p.productName ?? p.name,
      price: p.price,
      quantity: p.quantity,
      code: p.code,
    }));

    const result = await erpCreateOrder(
      { apiUrl: order.erpConfig.apiUrl, apiKey: order.erpConfig.apiKey },
      {
        customerPhone: order.customerPhone,
        extraPhone: order.extraPhone ?? undefined,
        address: order.address,
        district: order.district ?? undefined,
        province: order.province,
        shopSource: 'Facebook chatbot (retry)',
        products,
        operatorNote: 'Facebook chatbot автомат retry',
        chatbotOrderId: order.conversationId ?? undefined,
      },
    );

    if (result.error) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          retryCount: { increment: 1 },
          lastRetryAt: new Date(),
          lastError: typeof result.error === 'string' ? result.error : JSON.stringify(result.error),
        },
      });
      console.log(`[retry] order ${order.id} failed again`);
    } else {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'pending',
          erpOrderId: result.id,
          erpOrderNumber: result.orderNumber,
          retryCount: { increment: 1 },
          lastRetryAt: new Date(),
          lastError: null,
        },
      });
      await prisma.auditLog.create({
        data: {
          entityType: 'order',
          entityId: order.id,
          action: 'retry_succeeded',
          actorRole: 'worker',
          meta: {} as any,
        },
      });
      console.log(`[retry] order ${order.id} succeeded`);
    }
  }
}

function mongoliaTimeParts(d = new Date()): { y: number; m: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ulaanbaatar',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
  return {
    y: Number(map.year),
    m: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour === '24' ? '0' : map.hour),
    minute: Number(map.minute),
  };
}

function mongoliaDayStartUtc(d = new Date()): Date {
  const { y, m, day } = mongoliaTimeParts(d);
  // Mongolia is UTC+8 (no DST). Local midnight = UTC 16:00 previous day.
  return new Date(Date.UTC(y, m - 1, day, 0, 0, 0) - 8 * 60 * 60 * 1000);
}

let lastMorningRunKey: string | null = null;

async function processMorningConfirmations() {
  const mn = mongoliaTimeParts();
  if (mn.hour !== 9) return;
  const key = `${mn.y}-${mn.m}-${mn.day}`;
  if (lastMorningRunKey === key) return;
  lastMorningRunKey = key;

  const dayStartUtc = mongoliaDayStartUtc();
  const nineAmUtc = new Date(dayStartUtc.getTime() + 9 * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: dayStartUtc, lt: nineAmUtc },
      conversationId: { not: null },
      conversation: { morningConfirmedAt: null },
    },
    include: {
      conversation: { include: { page: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const seenConv = new Set<string>();
  for (const order of orders) {
    if (!order.conversationId) continue;
    if (seenConv.has(order.conversationId)) continue;
    seenConv.add(order.conversationId);

    const conv = order.conversation;
    if (!conv || !conv.page?.isActive || !conv.page?.accessToken) continue;

    const products = Array.isArray(order.products) ? (order.products as any[]) : [];
    const itemList = products.map((p) => `${p.productName ?? p.name} x ${p.quantity}ш`).join(', ');
    const totalQty = products.reduce((s, p) => s + (Number(p.quantity) || 0), 0);
    const productNameVal = products.length > 1 ? itemList : (products[0]?.productName ?? products[0]?.name ?? '');
    const loc = [order.province, order.district, order.address].filter(Boolean).join(', ');

    const template = await getBotMessage('morning_confirmation');
    const msg = template
      .replace(/\{productName\}/g, productNameVal)
      .replace(/\{quantity\}/g, String(totalQty))
      .replace(/\{address\}/g, loc);

    const ok = await sendText(conv.page.accessToken, conv.psid, msg).catch(() => false);
    if (ok) {
      await prisma.message.create({ data: { conversationId: conv.id, text: msg, isFromBot: true } });
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { morningConfirmedAt: new Date() },
      });
      console.log(`[morning] confirmation sent to ${conv.psid}`);
    }
  }
}

async function main() {
  console.log('[queue-worker] starting; poll interval=', POLL_INTERVAL_MS, 'ms');
  let lastReminderRun = 0;
  let lastRetryRun = 0;
  let lastMorningCheck = 0;
  const MORNING_CHECK_INTERVAL_MS = 60_000;
  while (true) {
    try {
      await processOne();
      if (Date.now() - lastReminderRun >= REMINDER_POLL_INTERVAL_MS) {
        lastReminderRun = Date.now();
        await processReminders().catch((e) => console.error('[reminders] error:', e));
        await processAbandonedFollowups().catch((e) => console.error('[followups] error:', e));
      }
      if (Date.now() - lastRetryRun >= RETRY_POLL_INTERVAL_MS) {
        lastRetryRun = Date.now();
        await processOrderRetries().catch((e) => console.error('[retry] error:', e));
      }
      if (Date.now() - lastMorningCheck >= MORNING_CHECK_INTERVAL_MS) {
        lastMorningCheck = Date.now();
        await processMorningConfirmations().catch((e) => console.error('[morning] error:', e));
      }
    } catch (e) {
      console.error('[queue-worker] error:', e);
    }
    await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
