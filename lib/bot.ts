import { prisma } from './prisma';
import { sendText, sendCarousel, sendImage, sendSenderAction, fetchUserProfile } from './facebook';
import { erpSearchProducts, erpGetProduct, erpCreateOrder, erpSearchOrders, type ErpConfigShape, type ErpProduct } from './erp';
import { extractProductCode, extractPhone, isOrderIntent, isBareOrderIntent, isPhoneOnlyMessage, isCancellationIntent } from './product-code';
import { latinToCyrillic } from './translit';
import { PROVINCES, UB_DISTRICTS, isUB, normalizeProvince, normalizeDistrict } from './provinces';
import { extractSlots } from './slot-extract';
import { getDeliveryMessage, isBotEnabled, isNightMode } from './settings';
import { extractPriceRange } from './fuzzy';
import { logAudit } from './audit';
import { getBotMessage } from './bot-messages';
import { detectNegative } from './negative-detect';
import { isStressTestMode } from './stress-test-mode';

const SPAM_ORDER_THRESHOLD = 5;
const TOP_PRODUCT_CODES = ['0140', '0177', '0152', 'P-0117', '0127', '0134'];

function sortByTopProducts<T extends { code?: string | null }>(products: T[]): T[] {
  const rank = new Map(TOP_PRODUCT_CODES.map((c, i) => [c.toUpperCase(), i]));
  return [...products].sort((a, b) => {
    const ra = a.code ? rank.get(a.code.toUpperCase()) ?? 999 : 999;
    const rb = b.code ? rank.get(b.code.toUpperCase()) ?? 999 : 999;
    return ra - rb;
  });
}
const SPAM_WINDOW_HOURS = 24;
const MAX_MISUNDERSTAND = 2;

type State =
  | 'IDLE' | 'PRODUCT' | 'PRODUCT_DETECTED' | 'QUANTITY'
  | 'PHONE' | 'EXTRA_PHONE' | 'PROVINCE' | 'DISTRICT'
  | 'ADDRESS' | 'NOTE' | 'CONFIRM' | 'DONE';

interface Ctx {
  selectedProduct?: ErpProduct;
  quantity?: number;
  phone?: string;
  extraPhone?: string;
  province?: string;
  district?: string;
  address?: string;
  note?: string;
  lastMessageTimes?: number[];
  rateLimitedUntil?: number;
  extraPhoneAsked?: boolean;
  misunderstandCount?: number;
}

interface CartItem { product: ErpProduct; quantity: number; }

interface HistoryEntry {
  state: State;
  ctx: Ctx;
  cart: CartItem[];
  at: number;
}

const BACK_WORDS = /^(буцах|өмнөх|back|цуцал.*сүүлийн|буцаая|өмнөхрүү|өмнө рүү)\b/i;
const CART_VIEW_WORDS = /сагс харах|миний сагс|захиалсан бараа|view cart|нийт бараа/i;
const ADD_MORE_WORDS = /нэмэлт бараа|өөр бараа|дахин нэмэх|бас нэмэх|add more|бараа нэмэх/i;

function pushHistory(history: HistoryEntry[], state: State, ctx: Ctx, cart: CartItem[]): HistoryEntry[] {
  const next = [...history, { state, ctx: { ...ctx }, cart: cart.map((c) => ({ ...c })), at: Date.now() }];
  return next.slice(-10);
}

export async function handleIncoming(pageId: string, psid: string, text: string, senderName?: string) {
  if (!(await isBotEnabled())) return;

  const page = await prisma.facebookPage.findUnique({
    where: { pageId },
    include: { erpConfig: true },
  });
  if (!page || !page.isActive) return;

  const bypassEnvGates = isStressTestMode() || psid.startsWith('stress-test-');
  if (!bypassEnvGates && await isNightMode()) {
    return;
  }

  let conv = await prisma.conversation.findUnique({
    where: { pageId_psid: { pageId, psid } },
  });

  if (!conv) {
    let displayName = senderName;
    if (!displayName) {
      const profile = await fetchUserProfile(page.accessToken, psid);
      if (profile) displayName = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim();
    }
    const priorOrder = await prisma.order.findFirst({
      where: { conversation: { psid } },
      select: { id: true },
    });
    conv = await prisma.conversation.create({
      data: { pageId, psid, senderName: displayName, state: 'IDLE', isReturningCustomer: !!priorOrder },
    });
  }

  await prisma.message.create({
    data: { conversationId: conv.id, text, isFromBot: false },
  });

  const ctx = (conv.context as Ctx) || {};
  if (typeof ctx.misunderstandCount !== 'number') {
    ctx.misunderstandCount = conv.misunderstandCount ?? 0;
  }
  const now = Date.now();
  const recent = (ctx.lastMessageTimes || []).filter((t) => now - t < 10000);
  recent.push(now);
  ctx.lastMessageTimes = recent;

  const bypassRateLimit = isStressTestMode() || psid.startsWith('stress-test-');
  if (!bypassRateLimit) {
    if (ctx.rateLimitedUntil && now < ctx.rateLimitedUntil) {
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { context: ctx as any, lastMessageAt: new Date(), unreadCount: { increment: 1 } },
      });
      return;
    }
    if (recent.length >= 3) {
      ctx.rateLimitedUntil = now + 30000;
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { context: ctx as any, lastMessageAt: new Date(), unreadCount: { increment: 1 } },
      });
      return;
    }
  }

  if (conv.isOperatorHandoff) {
    await prisma.conversation.update({
      where: { id: conv.id },
      data: { lastMessageAt: new Date(), unreadCount: { increment: 1 } },
    });
    return;
  }

  const spam = await prisma.spamBlock.findUnique({ where: { psid } }).catch(() => null);
  if (spam) {
    await prisma.conversation.update({
      where: { id: conv.id },
      data: { isOperatorHandoff: true, handoffReason: 'spam', lastMessageAt: new Date(), unreadCount: { increment: 1 } },
    });
    return;
  }

  const lowered = text.trim().toLowerCase();
  if (/оператор|хүн рүү|ажилтан|operator/.test(lowered)) {
    await handoffToOperator(page.accessToken, psid, conv.id, 'user_request');
    return;
  }

  const negative = detectNegative(text);
  if (negative) {
    await prisma.conversation.update({
      where: { id: conv.id },
      data: { sentiment: negative.sentiment },
    });
    await botSay(page.accessToken, psid, conv.id, negative.response);
    if (negative.resetToIdle) {
      await updateState(conv.id, 'IDLE', {}, []);
      return;
    }
    if (negative.handoff) {
      await handoffToOperator(page.accessToken, psid, conv.id, `negative:${negative.category}`);
      return;
    }
    return;
  }

  if (isCancellationIntent(lowered)) {
    await botSay(page.accessToken, psid, conv.id, await getBotMessage('order_cancelled'));
    await updateState(conv.id, 'IDLE', {}, []);
    return;
  }

  if (/захиалга.*хаана|хаана байна|захиалга шалгах|захиалга хянах|order status|миний захиалга/.test(lowered)) {
    await handleOrderStatusRequest(page, conv.id, psid, text);
    return;
  }

  const cart = (conv.cart as unknown as CartItem[]) || [];
  const state = conv.state as State;
  const history = (conv.history as unknown as HistoryEntry[]) || [];

  if (BACK_WORDS.test(text.trim())) {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      const trimmed = history.slice(0, -1);
      await prisma.conversation.update({
        where: { id: conv.id },
        data: {
          state: prev.state,
          context: prev.ctx as any,
          cart: prev.cart as any,
          history: trimmed as any,
          lastMessageAt: new Date(),
        },
      });
      await botSay(page.accessToken, psid, conv.id, 'Өмнөх алхам руу буцлаа. Дахин оруулна уу.');
      return;
    }
    await botSay(page.accessToken, psid, conv.id, 'Буцах алхам байхгүй байна.');
    return;
  }

  if (CART_VIEW_WORDS.test(text)) {
    await sendCartView(page.accessToken, psid, conv.id, cart);
    return;
  }

  if (/^захиалах$/i.test(text.trim()) && cart.length > 0) {
    const nextCtx = (conv.context as Ctx) || {};
    await advanceToNextMissing(page.accessToken, psid, conv.id, nextCtx, cart);
    return;
  }

  if (ADD_MORE_WORDS.test(text) && cart.length > 0) {
    const nextCtx = { ...(conv.context as Ctx) };
    delete nextCtx.selectedProduct;
    delete nextCtx.quantity;
    await botSay(page.accessToken, psid, conv.id, 'Дараагийн бүтээгдэхүүний нэр эсвэл кодыг бичнэ үү.');
    await updateState(conv.id, 'PRODUCT', nextCtx, cart);
    return;
  }

  if (state === 'DONE') {
    await botSay(
      page.accessToken,
      psid,
      conv.id,
      await getBotMessage('welcome'),
    );
    await updateState(conv.id, 'IDLE', {}, []);
    return;
  }
  let erpConfig: ErpConfigShape | null = page.erpConfig
    ? { apiUrl: page.erpConfig.apiUrl, apiKey: page.erpConfig.apiKey }
    : null;
  if (!erpConfig && isStressTestMode()) {
    erpConfig = { apiUrl: 'stress://local', apiKey: 'stress' };
  }

  const detectedCode = extractProductCode(text);
  if (state === 'IDLE' && detectedCode && isOrderIntent(text) && erpConfig) {
    await enterProductDetected(page, conv.id, psid, erpConfig, detectedCode, ctx);
    return;
  }

  if (state === 'IDLE') {
    const phoneOnly = isPhoneOnlyMessage(text);
    if (phoneOnly && !detectedCode) {
      ctx.phone = phoneOnly;
      await botSay(page.accessToken, psid, conv.id, await getBotMessage('phone_received_ask_product'));
      await updateState(conv.id, 'PRODUCT', ctx, cart);
      return;
    }
    if (isOrderIntent(text) && !detectedCode) {
      const greeting = conv.isReturningCustomer
        ? 'Сайн байна уу, дахин морилно уу! 😊\nЯмар бараа авахыг хүсч байна вэ?'
        : await getBotMessage('phone_received_ask_product');
      await botSay(page.accessToken, psid, conv.id, greeting);
      await updateState(conv.id, 'PRODUCT', ctx, cart);
      return;
    }
  }

  if (state !== 'CONFIRM') {
    const slots = extractSlots(text, {
      productSelected: !!ctx.selectedProduct || cart.length > 0,
      wantPhone: state === 'PHONE',
    });
    if (slots.phone && !ctx.phone) ctx.phone = slots.phone;
    if (slots.extraPhone && !ctx.extraPhone && slots.extraPhone !== ctx.phone) ctx.extraPhone = slots.extraPhone;
    if (slots.quantity && !ctx.quantity && (ctx.selectedProduct || cart.length > 0)) {
      ctx.quantity = slots.quantity;
      if (ctx.selectedProduct && !cart.find((c) => c.product.id === ctx.selectedProduct!.id)) {
        cart.push({ product: ctx.selectedProduct, quantity: slots.quantity });
      }
    }
    if (slots.province && !ctx.province) ctx.province = slots.province;
    if (slots.district && !ctx.district) ctx.district = slots.district;
    const addressEligibleState = state === 'IDLE' || state === 'PRODUCT' || state === 'ADDRESS';
    if (addressEligibleState && slots.address && !ctx.address && slots.address.length >= 10) {
      ctx.address = slots.address;
    }
  }

  await stepMachine({ page, erpConfig, convId: conv.id, psid, state, ctx, cart, text });
}

async function nextMissingPrompt(ctx: Ctx, cart: CartItem[]): Promise<{ state: State; ask: string; quickReplies?: string[] } | null> {
  if (!ctx.selectedProduct && cart.length === 0) {
    return { state: 'PRODUCT', ask: 'Ямар бүтээгдэхүүн захиалах вэ? Код эсвэл нэрийг бичнэ үү.' };
  }
  if (!ctx.quantity) {
    return { state: 'QUANTITY', ask: await getBotMessage('ask_quantity'), quickReplies: ['1', '2', '3', 'Өөр тоо'] };
  }
  if (!ctx.phone) {
    return { state: 'PHONE', ask: await getBotMessage('ask_phone') };
  }
  if (ctx.extraPhone === undefined && !ctx.extraPhoneAsked) {
    return { state: 'EXTRA_PHONE', ask: await getBotMessage('ask_extra_phone'), quickReplies: ['Байхгүй'] };
  }
  if (!ctx.province) {
    return { state: 'PROVINCE', ask: await getBotMessage('ask_province'), quickReplies: PROVINCES.slice(0, 12) };
  }
  if (isUB(ctx.province) && !ctx.district) {
    return { state: 'DISTRICT', ask: await getBotMessage('ask_district'), quickReplies: UB_DISTRICTS };
  }
  if (!ctx.address) {
    return { state: 'ADDRESS', ask: await getBotMessage('ask_address') };
  }
  if (ctx.note === undefined) {
    return { state: 'NOTE', ask: await getBotMessage('ask_note'), quickReplies: ['Байхгүй'] };
  }
  return null;
}

async function advanceToNextMissing(token: string, psid: string, convId: string, ctx: Ctx, cart: CartItem[]) {
  const next = await nextMissingPrompt(ctx, cart);
  if (!next) {
    const summary = buildSummary(cart, ctx);
    await botSay(token, psid, convId, summary, ['Тийм', 'Болих']);
    await updateState(convId, 'CONFIRM', ctx, cart);
    return;
  }
  await botSay(token, psid, convId, next.ask, next.quickReplies);
  await updateState(convId, next.state, ctx, cart);
}

async function botSay(token: string, psid: string, convId: string, text: string, quickReplies?: string[]) {
  await sendSenderAction(token, psid, 'mark_seen');
  await sendSenderAction(token, psid, 'typing_on');
  await new Promise((r) => setTimeout(r, 400));
  await sendText(token, psid, text, quickReplies);
  await sendSenderAction(token, psid, 'typing_off');
  await prisma.message.create({ data: { conversationId: convId, text, isFromBot: true } });
  await prisma.conversation.update({ where: { id: convId }, data: { lastMessageAt: new Date() } });
}

async function botSayImage(token: string, psid: string, convId: string, url: string) {
  await sendImage(token, psid, url);
  await prisma.message.create({ data: { conversationId: convId, text: `[Зураг: ${url}]`, isFromBot: true } });
}

async function handoffToOperator(token: string, psid: string, convId: string, reason: string) {
  await prisma.conversation.update({
    where: { id: convId },
    data: { isOperatorHandoff: true, handoffReason: reason, lastMessageAt: new Date(), unreadCount: { increment: 1 } },
  });
  await botSay(token, psid, convId, await getBotMessage('operator_handoff'));
  await logAudit({ entityType: 'conversation', entityId: convId, action: 'handoff', actorRole: 'bot', meta: { reason } });
}

async function updateState(convId: string, state: State, ctx: Ctx, cart?: CartItem[]) {
  const current = await prisma.conversation.findUnique({ where: { id: convId } });
  const data: any = { state, context: ctx as any, lastMessageAt: new Date() };
  if (cart) data.cart = cart as any;
  if (typeof ctx.misunderstandCount === 'number') {
    data.misunderstandCount = ctx.misunderstandCount;
  }
  if (current && current.state !== state) {
    const hist = (current.history as unknown as HistoryEntry[]) || [];
    data.history = pushHistory(
      hist,
      current.state as State,
      (current.context as Ctx) || {},
      (current.cart as unknown as CartItem[]) || [],
    ) as any;
  }
  if (state === 'CONFIRM') {
    data.abandonedAt = new Date();
    data.reminder1SentAt = null;
    data.reminder23SentAt = null;
  } else if (state === 'DONE' || state === 'IDLE') {
    data.abandonedAt = null;
  }
  await prisma.conversation.update({ where: { id: convId }, data });
}

async function sendCartView(token: string, psid: string, convId: string, cart: CartItem[]) {
  if (!cart.length) {
    await botSay(token, psid, convId, 'Таны сагс хоосон байна.');
    return;
  }
  const lines = cart.map(
    (c, i) => `${i + 1}. ${c.product.name} x ${c.quantity}ш = ${(c.product.price * c.quantity).toLocaleString()}₮`,
  );
  const total = cart.reduce((s, c) => s + c.product.price * c.quantity, 0);
  await botSay(
    token,
    psid,
    convId,
    `Таны сагс:\n${lines.join('\n')}\n------------------------\nНийт: ${total.toLocaleString()}₮`,
    ['Нэмэлт бараа нэмэх', 'Захиалах'],
  );
}

async function sendProductGallery(token: string, psid: string, convId: string, product: ErpProduct) {
  const images = (product.images || []).filter(Boolean);
  if (images.length <= 1) return;
  for (const url of images.slice(0, 4)) {
    await botSayImage(token, psid, convId, url);
  }
}

async function checkAndFlagSpam(pageId: string, psid: string, convId: string): Promise<boolean> {
  const since = new Date(Date.now() - SPAM_WINDOW_HOURS * 60 * 60 * 1000);
  const orders = await prisma.order.count({ where: { conversationId: convId, createdAt: { gte: since } } });
  if (orders >= SPAM_ORDER_THRESHOLD) {
    await prisma.spamBlock.upsert({
      where: { psid },
      create: { psid, pageId, reason: 'order_flood', orderCount: orders },
      update: { orderCount: orders, blockedAt: new Date() },
    });
    await logAudit({ entityType: 'spam', entityId: psid, action: 'blocked', meta: { orders, pageId } });
    return true;
  }
  return false;
}

async function enterProductDetected(
  page: any, convId: string, psid: string, erpConfig: ErpConfigShape, code: string, ctx: Ctx
) {
  const results = await erpSearchProducts(erpConfig, code, 1);
  const product = results[0];
  if (!product) {
    await botSay(page.accessToken, psid, convId, await getBotMessage('product_not_found'));
    await updateState(convId, 'IDLE', ctx);
    return;
  }
  ctx.selectedProduct = product;
  await botSay(page.accessToken, psid, convId,
    `${product.name}\nҮнэ: ${product.price.toLocaleString()}₮\n${await getBotMessage('ask_quantity')}`,
    ['1', '2', '3', 'Өөр тоо']);
  await updateState(convId, 'QUANTITY', ctx);
}

async function handleOrderStatusRequest(page: any, convId: string, psid: string, text: string) {
  const phone = extractPhone(text);
  let searchPhone = phone;
  if (!searchPhone) {
    const lastOrder = await prisma.order.findFirst({
      where: { conversationId: convId },
      orderBy: { createdAt: 'desc' },
    });
    if (lastOrder) searchPhone = lastOrder.customerPhone;
  }
  if (searchPhone && page.erpConfig) {
    const orders = await erpSearchOrders(
      { apiUrl: page.erpConfig.apiUrl, apiKey: page.erpConfig.apiKey },
      searchPhone,
    ).catch(() => []);
    if (orders.length) {
      await botSay(page.accessToken, psid, convId,
        `Таны захиалга:\n${orders.slice(0, 5).map((o: any) => `#${o.orderNumber || o.id} - ${o.status}`).join('\n')}`);
      return;
    }
  }
  await botSay(page.accessToken, psid, convId, 'Утасны дугаараа бичнэ үү. Би таны захиалгуудыг шалгаж өгнө.');
}

interface StepArgs {
  page: any;
  erpConfig: ErpConfigShape | null;
  convId: string;
  psid: string;
  state: State;
  ctx: Ctx;
  cart: CartItem[];
  text: string;
}

async function stepMachine(a: StepArgs) {
  const { page, erpConfig, convId, psid, text, ctx } = a;
  let { state, cart } = a;
  const token = page.accessToken;
  const t = text.trim();

  if (
    state !== 'IDLE' &&
    state !== 'DONE' &&
    isCancellationIntent(t.toLowerCase())
  ) {
    await botSay(token, psid, convId, await getBotMessage('order_cancelled'));
    await updateState(convId, 'IDLE', {}, []);
    return;
  }

  switch (state) {
    case 'IDLE':
    case 'PRODUCT': {
      if (!erpConfig) {
        await botSay(token, psid, convId, 'Түр зуурын саатал гарлаа. Оператортой холбогдоно уу.');
        return;
      }
      if (isBareOrderIntent(t) && !ctx.selectedProduct && cart.length === 0) {
        await botSay(token, psid, convId,
          'Та ямар бүтээгдэхүүн захиалах вэ? Бүтээгдэхүүний код эсвэл нэрийг бичнэ үү.');
        await updateState(convId, 'PRODUCT', ctx);
        return;
      }
      const slots = extractSlots(t, { productSelected: false, wantPhone: false });
      if (slots.phone && !ctx.phone) ctx.phone = slots.phone;
      if (slots.province && !ctx.province) ctx.province = slots.province;
      if (slots.district && !ctx.district) ctx.district = slots.district;

      const addressKeywordRe = /хороо|тоот|байр|орц|давхар/i;
      const looksLikeAddress = addressKeywordRe.test(t);
      if (
        looksLikeAddress &&
        slots.address &&
        slots.address.length >= 10 &&
        !ctx.address
      ) {
        ctx.address = slots.address;
      }

      const intentWordsRe = /(авъя|авья|авна|авмаар|авии|авъя|захиалъя|захиалая|захиалах|awii|zahialay)/gi;
      const hasCustomerSlot = !!(slots.phone || slots.district || slots.province || ctx.address);

      if (hasCustomerSlot && !slots.productCode) {
        let leftover = t
          .replace(slots.phone || '', ' ')
          .replace(/(\d+\s*р?\s*хороо|\d+\s*тоот|\d+\s*байр|\d+\s*орц|\d+\s*давхар|хороо|тоот|байр|орц|давхар)/gi, ' ')
          .replace(intentWordsRe, ' ')
          .replace(/\d+/g, ' ');
        if (slots.district) {
          leftover = leftover.replace(new RegExp(slots.district, 'gi'), ' ');
          leftover = leftover.replace(/\b(бзд|бгд|схд|сбд|худ|чд|хчд|bzd|bgd|shd|sxd|sbd|hud|xud|chd|hchd)\b/gi, ' ');
        }
        if (slots.province) {
          leftover = leftover.replace(new RegExp(slots.province, 'gi'), ' ');
          leftover = leftover.replace(/\bуб\b|\bub\b|\bулаанбаатар\b|\bулаанбаатар\s*хот\b|\bаймаг\b/gi, ' ');
        }
        leftover = leftover.replace(/\s+/g, ' ').trim();
        const hasLikelyProductText = /[а-яөүёa-z]{3,}/i.test(leftover);
        if (!hasLikelyProductText) {
          const savedParts: string[] = [];
          if (slots.phone) savedParts.push(`Утас: ${slots.phone}`);
          if (slots.province) savedParts.push(`Аймаг: ${slots.province}`);
          if (slots.district) savedParts.push(`Дүүрэг: ${slots.district}`);
          if (ctx.address) savedParts.push(`Хаяг: ${ctx.address}`);
          const prefix = savedParts.length ? `Хадгалсан:\n${savedParts.join('\n')}\n\n` : '';
          await botSay(
            token,
            psid,
            convId,
            `${prefix}Ямар бараа авахыг хүсч байна вэ? Бүтээгдэхүүний код эсвэл нэрийг бичнэ үү.`,
          );
          await updateState(convId, 'PRODUCT', ctx, cart);
          return;
        }
      }

      const priceRange = extractPriceRange(t);
      let nameQuery = t.replace(intentWordsRe, ' ');
      if (slots.phone) nameQuery = nameQuery.replace(slots.phone, ' ');
      if (slots.extraPhone) nameQuery = nameQuery.replace(slots.extraPhone, ' ');
      nameQuery = nameQuery
        .replace(/(\d+\s*р?\s*хороо|\d+\s*тоот|\d+\s*байр|\d+\s*орц|\d+\s*давхар|хороо|тоот|байр|орц|давхар)/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const query = slots.productCode ?? (nameQuery.length >= 2 ? nameQuery : slots.remainingText);
      if (!query || query.length < 2) {
        await botSay(
          token,
          psid,
          convId,
          'Ямар бараа авахыг хүсч байна вэ? Бүтээгдэхүүний код эсвэл нэрийг бичнэ үү.',
        );
        await updateState(convId, 'PRODUCT', ctx, cart);
        return;
      }
      let products = await erpSearchProducts(erpConfig, query, 10);

      if (priceRange) {
        products = products.filter((p) => {
          if (priceRange.max !== undefined && p.price > priceRange.max) return false;
          if (priceRange.min !== undefined && p.price < priceRange.min) return false;
          return true;
        });
      }

      if (!products.length && query.length >= 3) {
        // Fuzzy fallback: try with first 3 chars prefix to be tolerant to typos
        const stem = query.slice(0, Math.max(3, query.length - 2));
        products = await erpSearchProducts(erpConfig, stem, 10);
        if (priceRange) {
          products = products.filter((p) => {
            if (priceRange.max !== undefined && p.price > priceRange.max) return false;
            if (priceRange.min !== undefined && p.price < priceRange.min) return false;
            return true;
          });
        }
      }

      if (!products.length) {
        ctx.misunderstandCount = (ctx.misunderstandCount ?? 0) + 1;
        if (ctx.misunderstandCount >= MAX_MISUNDERSTAND) {
          await handoffToOperator(token, psid, convId, 'no_product_found');
          return;
        }
        await botSay(token, psid, convId, await getBotMessage('product_not_found'));
        await updateState(convId, 'PRODUCT', ctx, cart);
        return;
      }
      ctx.misunderstandCount = 0;
      products = sortByTopProducts(products).slice(0, 5);
      if (products.length === 1) {
        ctx.selectedProduct = products[0];
        await sendProductGallery(token, psid, convId, products[0]);
        if (slots.quantity) {
          ctx.quantity = slots.quantity;
          if (!cart.find((c) => c.product.id === products[0].id)) {
            cart.push({ product: products[0], quantity: slots.quantity });
          }
          await botSay(token, psid, convId,
            `${products[0].name} x ${slots.quantity}ш сонгогдлоо.`);
          await advanceToNextMissing(token, psid, convId, ctx, cart);
          return;
        }
        await botSay(token, psid, convId,
          `${products[0].name}\nҮнэ: ${products[0].price.toLocaleString()}₮\n${await getBotMessage('ask_quantity')}`,
          ['1', '2', '3', 'Өөр тоо']);
        await updateState(convId, 'QUANTITY', ctx, cart);
        return;
      }
      await sendCarousel(token, psid, products.map((p) => ({
        title: `${p.name} - ${p.price.toLocaleString()}₮`,
        subtitle: p.code,
        image_url: p.images?.[0],
        buttons: [{ type: 'postback', title: 'Захиалах', payload: `SELECT_${p.id}` }],
      })));
      await prisma.message.create({ data: { conversationId: convId, text: `[Carousel: ${products.length} бараа]`, isFromBot: true } });
      await updateState(convId, 'PRODUCT', ctx, cart);
      return;
    }
    case 'QUANTITY': {
      if (!ctx.quantity) {
        const tl = t.toLowerCase();
        const wordNums: Record<string, number> = {
          'нэг': 1, 'хоёр': 2, 'гурав': 3, 'дөрөв': 4, 'тав': 5,
          'зургаа': 6, 'долоо': 7, 'найм': 8, 'ес': 9, 'арав': 10,
          'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
        };
        let qty = parseInt(t.replace(/[^\d]/g, ''), 10);
        if ((!qty || qty < 1)) {
          for (const [w, n] of Object.entries(wordNums)) {
            if (tl.includes(w)) { qty = n; break; }
          }
        }
        if (!qty || qty < 1) {
          await botSay(token, psid, convId, 'Тоогоор бичнэ үү. Жишээ: 1, 2, 3');
          return;
        }
        ctx.quantity = qty;
        if (ctx.selectedProduct && !cart.find((c) => c.product.id === ctx.selectedProduct!.id)) {
          cart.push({ product: ctx.selectedProduct, quantity: qty });
        }
      }
      await advanceToNextMissing(token, psid, convId, ctx, cart);
      return;
    }
    case 'PHONE': {
      if (!ctx.phone) {
        const phone = extractPhone(t);
        if (!phone) {
          await botSay(token, psid, convId, '8 оронтой утасны дугаараа оруулна уу.\nЖишээ: 88112233');
          return;
        }
        ctx.phone = phone;
      }
      await advanceToNextMissing(token, psid, convId, ctx, cart);
      return;
    }
    case 'EXTRA_PHONE': {
      if (ctx.extraPhone === undefined) {
        if (/^\s*0\s*$|байхгүй|байхгуй|bhkg|үгүй|угуй|\bno\b|үгүйээ|ugui/i.test(t)) {
          ctx.extraPhoneAsked = true;
        } else {
          const extra = extractPhone(t);
          if (extra) {
            ctx.extraPhone = extra;
          } else {
            ctx.extraPhoneAsked = true;
          }
        }
      }
      await advanceToNextMissing(token, psid, convId, ctx, cart);
      return;
    }
    case 'PROVINCE': {
      if (!ctx.province) {
        const normalized = normalizeProvince(t);
        ctx.province = normalized || t;
      }
      await advanceToNextMissing(token, psid, convId, ctx, cart);
      return;
    }
    case 'DISTRICT': {
      if (!ctx.district) {
        const d = normalizeDistrict(t);
        ctx.district = d || t.toUpperCase();
      }
      await advanceToNextMissing(token, psid, convId, ctx, cart);
      return;
    }
    case 'ADDRESS': {
      if (!ctx.address) {
        const wordCount = t.split(/\s+/).filter(Boolean).length;
        if (t.length < 10 || wordCount < 2) {
          await botSay(token, psid, convId, 'Хаягаа дэлгэрэнгүй бичнэ үү (хороо, байр, тоот, орц, давхар).');
          return;
        }
        ctx.address = t;
      }
      await advanceToNextMissing(token, psid, convId, ctx, cart);
      return;
    }
    case 'NOTE': {
      if (ctx.note === undefined) {
        ctx.note = /^\s*0\s*$|байхгүй|байхгуй|үгүй|угуй|\bno\b|bhkg|ugui/i.test(t) ? '' : t;
      }
      await advanceToNextMissing(token, psid, convId, ctx, cart);
      return;
    }
    case 'CONFIRM': {
      if (/тийм|тиймээ|тээ|за\b|болно|зөв|zov|yes|yep|yeah|баталгаажуул|batalgaa|ok|okay|tiim/i.test(t)) {
        await submitOrder(page, erpConfig, convId, psid, ctx, cart);
        return;
      }
      if (/болих|цуцлах|tsutslah|bolih|cancel|үгүй|угуй|\bno\b|ugui/i.test(t)) {
        await botSay(token, psid, convId, 'Захиалга цуцлагдлаа. Шинэ захиалга өгөхийн тулд бүтээгдэхүүний нэрээ бичнэ үү.');
        await updateState(convId, 'IDLE', {}, []);
        return;
      }
      await botSay(token, psid, convId, 'Тийм эсвэл Болих гэж хариулна уу.', ['Тийм', 'Болих']);
      return;
    }
    case 'PRODUCT_DETECTED':
    case 'DONE':
    default: {
      const phone = extractPhone(t);
      if (phone && erpConfig) {
        const orders = await erpSearchOrders(erpConfig, phone);
        if (orders.length) {
          await botSay(token, psid, convId,
            `Таны захиалга:\n${orders.slice(0, 3).map((o: any) => `#${o.orderNumber} - ${o.status}`).join('\n')}`);
          return;
        }
      }
      await botSay(token, psid, convId, await getBotMessage('welcome'));
      await updateState(convId, 'PRODUCT', {}, []);
    }
  }
}

function buildSummary(cart: CartItem[], ctx: Ctx): string {
  const items = cart.map((c) => `${c.product.name} x ${c.quantity}ш`).join('\n');
  const total = cart.reduce((sum, c) => sum + c.product.price * c.quantity, 0);
  const loc = [ctx.province, ctx.district, ctx.address].filter(Boolean).join(', ');
  return [
    'ЗАХИАЛГЫН МЭДЭЭЛЭЛ:',
    '------------------------',
    `Бараа:\n${items}`,
    `Нийт: ${total.toLocaleString()}₮`,
    `Утас: ${ctx.phone}${ctx.extraPhone ? ' / ' + ctx.extraPhone : ''}`,
    `Хаяг: ${loc}`,
    ctx.note ? `Тэмдэглэл: ${ctx.note}` : '',
    '------------------------',
    'Захиалга баталгаажуулах уу?',
  ].filter(Boolean).join('\n');
}

async function submitOrder(page: any, erpConfig: ErpConfigShape | null, convId: string, psid: string, ctx: Ctx, cart: CartItem[]) {
  const total = cart.reduce((s, c) => s + c.product.price * c.quantity, 0);
  const products = cart.map((c) => ({
    productId: c.product.id,
    productName: c.product.name,
    price: c.product.price,
    quantity: c.quantity,
    code: c.product.code,
  }));

  let erpResult: any = {};
  let lastError: string | undefined;
  let attempts = 0;
  if (erpConfig) {
    for (attempts = 1; attempts <= 3; attempts++) {
      erpResult = await erpCreateOrder(erpConfig, {
        customerPhone: ctx.phone!,
        extraPhone: ctx.extraPhone,
        address: ctx.address!,
        district: ctx.district,
        province: ctx.province!,
        shopSource: `Facebook - ${page.pageName}`,
        products,
        operatorNote: 'Facebook chatbot захиалга',
        chatbotOrderId: convId,
      });
      if (!erpResult.error) break;
      lastError = typeof erpResult.error === 'string' ? erpResult.error : JSON.stringify(erpResult.error);
      if (attempts < 3) await new Promise((r) => setTimeout(r, 500 * attempts));
    }
  }

  const failed = !erpConfig || !!erpResult.error;
  const order = await prisma.order.create({
    data: {
      conversationId: convId,
      erpConfigId: page.erpConfigId,
      erpOrderId: erpResult.id,
      erpOrderNumber: erpResult.orderNumber,
      customerPhone: ctx.phone!,
      extraPhone: ctx.extraPhone,
      province: ctx.province!,
      district: ctx.district,
      address: ctx.address!,
      note: ctx.note,
      products: products as any,
      totalAmount: total,
      status: failed ? 'failed' : 'pending',
      retryCount: Math.max(0, attempts - 1),
      lastRetryAt: attempts > 1 ? new Date() : null,
      lastError: failed ? lastError ?? null : null,
    },
  });
  await logAudit({ entityType: 'order', entityId: order.id, action: failed ? 'create_failed' : 'created', actorRole: 'bot', meta: { attempts, total } });

  if (await checkAndFlagSpam(page.pageId, psid, convId)) {
    await botSay(page.accessToken, psid, convId, 'Таны захиалга операторт шилжүүллээ. Баярлалаа.');
    await prisma.conversation.update({ where: { id: convId }, data: { isOperatorHandoff: true, handoffReason: 'spam' } });
    return;
  }

  if (failed) {
    await botSay(page.accessToken, psid, convId, await getBotMessage('order_fail'));
    await prisma.conversation.update({ where: { id: convId }, data: { isOperatorHandoff: true, handoffReason: 'erp_failed' } });
    return;
  }

  const when = await getDeliveryMessage();
  const loc = [ctx.province, ctx.district, ctx.address].filter(Boolean).join(', ');
  const itemList = cart.map((c) => `${c.product.name} x ${c.quantity}ш`).join(', ');
  const totalQty = cart.reduce((s, c) => s + c.quantity, 0);
  const firstProductName = cart[0]?.product.name ?? '';
  const productNameVal = cart.length > 1 ? itemList : firstProductName;

  const mnHour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ulaanbaatar', hour: 'numeric', hour12: false }).format(new Date()));
  const isNightOrder = mnHour >= 0 && mnHour < 9;
  const isAimag = !!(ctx.province && !isUB(ctx.province));

  const templateKey = isNightOrder && !isAimag ? 'night_order_received' : 'order_success';
  const template = await getBotMessage(templateKey);
  const successMsg = template
    .replace(/\{productName\}/g, productNameVal)
    .replace(/\{quantity\}/g, String(totalQty))
    .replace(/\{address\}/g, loc)
    .replace(/\{deliveryTime\}/g, when);
  await botSay(page.accessToken, psid, convId, successMsg, ['Шинэ захиалга', 'Захиалга хянах']);

  if (isAimag) {
    const aimagTpl = await getBotMessage('aimag_payment');
    if (aimagTpl) {
      const aimagMsg = aimagTpl
        .replace(/\{productName\}/g, productNameVal)
        .replace(/\{quantity\}/g, String(totalQty))
        .replace(/\{address\}/g, loc)
        .replace(/\{deliveryTime\}/g, when);
      await botSay(page.accessToken, psid, convId, aimagMsg);
    }
  }
  await updateState(convId, 'DONE', {}, []);
}

export async function handlePostback(pageId: string, psid: string, payload: string) {
  const page = await prisma.facebookPage.findUnique({
    where: { pageId },
    include: { erpConfig: true },
  });
  if (!page) return;
  const conv = await prisma.conversation.findUnique({ where: { pageId_psid: { pageId, psid } } });
  if (!conv) return;

  if (payload.startsWith('SELECT_') && page.erpConfig) {
    const productId = payload.slice(7);
    const product = await erpGetProduct(
      { apiUrl: page.erpConfig.apiUrl, apiKey: page.erpConfig.apiKey },
      productId,
    );
    if (!product) return;
    const ctx = (conv.context as Ctx) || {};
    const cart = (conv.cart as unknown as CartItem[]) || [];
    ctx.selectedProduct = product;
    await sendText(page.accessToken, psid,
      `${product.name} сонгогдлоо.\nҮнэ: ${product.price.toLocaleString()}₮\nХэдэн ширхэг авах вэ?`,
      ['1', '2', '3', 'Өөр тоо']);
    await prisma.message.create({
      data: {
        conversationId: conv.id,
        text: `${product.name} сонгогдлоо. Хэдэн ширхэг авах вэ?`,
        isFromBot: true,
      },
    });
    await updateState(conv.id, 'QUANTITY', ctx, cart);
  }
}
