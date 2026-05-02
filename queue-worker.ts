import { PrismaClient } from '@prisma/client';
import { replyToComment, reactToComment, sendText } from './lib/facebook';
import { pickReplyByCategory, detectCommentCategory } from './lib/comment-filter';
import { erpCreateOrder } from './lib/erp';

const prisma = new PrismaClient();
const POLL_INTERVAL_MS = 5000;
const REMINDER_POLL_INTERVAL_MS = 60_000;
const RETRY_POLL_INTERVAL_MS = 2 * 60_000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const REMINDER_1_DELAY_MS = 1 * ONE_HOUR_MS;
const REMINDER_23_DELAY_MS = 23 * ONE_HOUR_MS;
const FACEBOOK_WINDOW_MS = 24 * ONE_HOUR_MS;
const MAX_ORDER_RETRY = 3;

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
  if (await isNightMode()) return;

  const now = new Date();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const candidate = await prisma.commentLead.findFirst({
    where: {
      status: 'queued',
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
    },
    orderBy: { scheduledFor: 'asc' },
  });
  if (!candidate) return;

  const page = await prisma.facebookPage.findUnique({ where: { pageId: candidate.pageId } });
  if (!page || !page.isActive || !page.autoReplyEnabled) {
    await prisma.commentLead.update({ where: { id: candidate.id }, data: { status: 'skipped' } });
    return;
  }

  const sentThisHour = await prisma.commentLead.count({
    where: { pageId: page.pageId, status: 'sent', sentAt: { gte: hourAgo } },
  });
  if (sentThisHour >= page.hourlyCommentLimit) {
    await prisma.commentLead.update({
      where: { id: candidate.id },
      data: { scheduledFor: new Date(Date.now() + 60 * 60 * 1000) },
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

  console.log(`[queue] ${ok ? 'sent' : 'failed'} reply to ${candidate.commentId} (${page.pageName})`);
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

    if (age >= REMINDER_23_DELAY_MS && !conv.reminder23SentAt && age < FACEBOOK_WINDOW_MS) {
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

async function main() {
  console.log('[queue-worker] starting; poll interval=', POLL_INTERVAL_MS, 'ms');
  let lastReminderRun = 0;
  let lastRetryRun = 0;
  while (true) {
    try {
      await processOne();
      if (Date.now() - lastReminderRun >= REMINDER_POLL_INTERVAL_MS) {
        lastReminderRun = Date.now();
        await processReminders().catch((e) => console.error('[reminders] error:', e));
      }
      if (Date.now() - lastRetryRun >= RETRY_POLL_INTERVAL_MS) {
        lastRetryRun = Date.now();
        await processOrderRetries().catch((e) => console.error('[retry] error:', e));
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
