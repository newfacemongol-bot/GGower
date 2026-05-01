import { prisma } from './prisma';
import { sendText, sendCarousel, fetchUserProfile } from './facebook';
import { erpSearchProducts, erpGetProduct, erpCreateOrder, erpSearchOrders, type ErpConfigShape, type ErpProduct } from './erp';
import { extractProductCode, extractPhone, isOrderIntent, isBareOrderIntent } from './product-code';
import { latinToCyrillic } from './translit';
import { PROVINCES, UB_DISTRICTS, isUB, normalizeProvince, normalizeDistrict } from './provinces';
import { getDeliveryMessage, isBotEnabled, isNightMode } from './settings';

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
}

interface CartItem { product: ErpProduct; quantity: number; }

export async function handleIncoming(pageId: string, psid: string, text: string, senderName?: string) {
  if (!(await isBotEnabled())) return;

  const page = await prisma.facebookPage.findUnique({
    where: { pageId },
    include: { erpConfig: true },
  });
  if (!page || !page.isActive) return;

  if (await isNightMode()) {
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
    conv = await prisma.conversation.create({
      data: { pageId, psid, senderName: displayName, state: 'IDLE' },
    });
  }

  await prisma.message.create({
    data: { conversationId: conv.id, text, isFromBot: false },
  });

  const ctx = (conv.context as Ctx) || {};
  const now = Date.now();
  const recent = (ctx.lastMessageTimes || []).filter((t) => now - t < 10000);
  recent.push(now);
  ctx.lastMessageTimes = recent;

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

  if (conv.isOperatorHandoff) {
    await prisma.conversation.update({
      where: { id: conv.id },
      data: { lastMessageAt: new Date(), unreadCount: { increment: 1 } },
    });
    return;
  }

  const lowered = text.trim().toLowerCase();
  if (/оператор|хүн рүү|ажилтан|operator/.test(lowered)) {
    await prisma.conversation.update({
      where: { id: conv.id },
      data: { isOperatorHandoff: true, lastMessageAt: new Date(), unreadCount: { increment: 1 } },
    });
    await botSay(page.accessToken, psid, conv.id, 'Таныг оператортой холбож байна. Түр хүлээнэ үү.');
    return;
  }

  if (/захиалга.*хаана|хаана байна/.test(lowered)) {
    await handleOrderStatusRequest(page, conv.id, psid);
    return;
  }

  const cart = (conv.cart as unknown as CartItem[]) || [];
  const state = conv.state as State;
  const erpConfig: ErpConfigShape | null = page.erpConfig
    ? { apiUrl: page.erpConfig.apiUrl, apiKey: page.erpConfig.apiKey }
    : null;

  const detectedCode = extractProductCode(text);
  if (state === 'IDLE' && detectedCode && isOrderIntent(text) && erpConfig) {
    await enterProductDetected(page, conv.id, psid, erpConfig, detectedCode, ctx);
    return;
  }

  await stepMachine({ page, erpConfig, convId: conv.id, psid, state, ctx, cart, text });
}

async function botSay(token: string, psid: string, convId: string, text: string, quickReplies?: string[]) {
  await sendText(token, psid, text, quickReplies);
  await prisma.message.create({ data: { conversationId: convId, text, isFromBot: true } });
  await prisma.conversation.update({ where: { id: convId }, data: { lastMessageAt: new Date() } });
}

async function updateState(convId: string, state: State, ctx: Ctx, cart?: CartItem[]) {
  const data: any = { state, context: ctx as any, lastMessageAt: new Date() };
  if (cart) data.cart = cart as any;
  await prisma.conversation.update({ where: { id: convId }, data });
}

async function enterProductDetected(
  page: any, convId: string, psid: string, erpConfig: ErpConfigShape, code: string, ctx: Ctx
) {
  const results = await erpSearchProducts(erpConfig, code, 1);
  const product = results[0];
  if (!product) {
    await botSay(page.accessToken, psid, convId,
      'Уучлаарай, бүтээгдэхүүн олдсонгүй. Дахин оролдоно уу.');
    await updateState(convId, 'IDLE', ctx);
    return;
  }
  ctx.selectedProduct = product;
  await botSay(page.accessToken, psid, convId,
    `${product.name}\nҮнэ: ${product.price.toLocaleString()}₮\nХэдэн ширхэг авах вэ?`,
    ['1', '2', '3', 'Өөр тоо']);
  await updateState(convId, 'QUANTITY', ctx);
}

async function handleOrderStatusRequest(page: any, convId: string, psid: string) {
  await botSay(page.accessToken, psid, convId, 'Захиалгын дугаараа эсвэл утасны дугаараа бичнэ үү:');
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

  switch (state) {
    case 'IDLE': {
      await botSay(token, psid, convId,
        'Сайн байна уу! Би захиалга авах бот байна. Ямар бүтээгдэхүүн авахыг хүсч байна вэ? Бүтээгдэхүүний код эсвэл нэрийг бичнэ үү.');
      await updateState(convId, 'PRODUCT', ctx);
      return;
    }
    case 'PRODUCT': {
      if (!erpConfig) {
        await botSay(token, psid, convId, 'Түр зуурын саатал гарлаа. Оператортой холбогдоно уу.');
        return;
      }
      if (isBareOrderIntent(t)) {
        await botSay(token, psid, convId,
          'Та ямар бүтээгдэхүүн захиалах вэ? Бүтээгдэхүүний код эсвэл нэрийг бичнэ үү.');
        return;
      }
      const normalized = latinToCyrillic(t);
      const query = extractProductCode(t) ?? normalized;
      const products = await erpSearchProducts(erpConfig, query, 5);
      if (!products.length) {
        await botSay(token, psid, convId, 'Уучлаарай, бүтээгдэхүүн олдсонгүй. Дахин оролдоно уу.');
        return;
      }
      if (products.length === 1) {
        ctx.selectedProduct = products[0];
        await botSay(token, psid, convId,
          `${products[0].name}\nҮнэ: ${products[0].price.toLocaleString()}₮\nХэдэн ширхэг авах вэ?`,
          ['1', '2', '3', 'Өөр тоо']);
        await updateState(convId, 'QUANTITY', ctx);
        return;
      }
      await sendCarousel(token, psid, products.map((p) => ({
        title: `${p.name} - ${p.price.toLocaleString()}₮`,
        subtitle: p.code,
        image_url: p.images?.[0],
        buttons: [{ type: 'postback', title: 'Захиалах', payload: `SELECT_${p.id}` }],
      })));
      await prisma.message.create({ data: { conversationId: convId, text: `[Carousel: ${products.length} бараа]`, isFromBot: true } });
      return;
    }
    case 'QUANTITY': {
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
      if (ctx.selectedProduct) {
        cart.push({ product: ctx.selectedProduct, quantity: qty });
      }
      await botSay(token, psid, convId, 'Холбоо барих утасны дугаараа оруулна уу:');
      await updateState(convId, 'PHONE', ctx, cart);
      return;
    }
    case 'PHONE': {
      const phone = extractPhone(t);
      if (!phone) {
        await botSay(token, psid, convId, '8 оронтой, 7/8/9-өөр эхэлсэн дугаар оруулна уу.\nЖишээ: 88112233');
        return;
      }
      const existing = await prisma.order.findFirst({
        where: { customerPhone: phone, status: { in: ['pending', 'confirmed', 'processing'] } },
      });
      if (existing && Date.now() - existing.createdAt.getTime() < 60 * 60 * 1000) {
        await botSay(token, psid, convId,
          'Энэ утасны дугаараар идэвхтэй захиалга байна. Асуудал байвал оператортой холбогдоно уу.');
      }
      ctx.phone = phone;
      await botSay(token, psid, convId, 'Нэмэлт утасны дугаар байна уу?', ['Байхгүй']);
      await updateState(convId, 'EXTRA_PHONE', ctx);
      return;
    }
    case 'EXTRA_PHONE': {
      if (/^\s*0\s*$|байхгүй|байхгуй|bhkg|үгүй|угуй|\bno\b|үгүйээ|ugui/i.test(t)) {
        ctx.extraPhone = undefined;
      } else {
        const extra = extractPhone(t);
        ctx.extraPhone = extra ?? undefined;
      }
      await botSay(token, psid, convId, 'Хүргэлт хаашаа вэ?', PROVINCES.slice(0, 12));
      await updateState(convId, 'PROVINCE', ctx);
      return;
    }
    case 'PROVINCE': {
      const normalized = normalizeProvince(t);
      ctx.province = normalized || t;
      if (isUB(ctx.province)) {
        await botSay(token, psid, convId, 'Аль дүүрэгт хүргэх вэ?', UB_DISTRICTS);
        await updateState(convId, 'DISTRICT', ctx);
      } else {
        await botSay(token, psid, convId, 'Дэлгэрэнгүй хаягаа бичнэ үү:\n(Хороо, байр, тоот, орц, давхар)');
        await updateState(convId, 'ADDRESS', ctx);
      }
      return;
    }
    case 'DISTRICT': {
      const d = normalizeDistrict(t);
      ctx.district = d || t.toUpperCase();
      await botSay(token, psid, convId, 'Дэлгэрэнгүй хаягаа бичнэ үү:\n(Хороо, байр, тоот, орц, давхар)');
      await updateState(convId, 'ADDRESS', ctx);
      return;
    }
    case 'ADDRESS': {
      if (t.length < 5) {
        await botSay(token, psid, convId, 'Хаягаа дэлгэрэнгүй бичнэ үү (5-с илүү тэмдэгт).');
        return;
      }
      ctx.address = t;
      await botSay(token, psid, convId, 'Нэмэлт тэмдэглэл байна уу?', ['Байхгүй']);
      await updateState(convId, 'NOTE', ctx);
      return;
    }
    case 'NOTE': {
      ctx.note = /^\s*0\s*$|байхгүй|байхгуй|үгүй|угуй|\bno\b|bhkg|ugui/i.test(t) ? '' : t;
      const summary = buildSummary(cart, ctx);
      await botSay(token, psid, convId, summary, ['Тийм', 'Болих']);
      await updateState(convId, 'CONFIRM', ctx, cart);
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
      await botSay(token, psid, convId,
        'Сайн байна уу! Би захиалга авах бот байна. Бүтээгдэхүүний код эсвэл нэрийг бичнэ үү.');
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
  if (erpConfig) {
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
  }

  await prisma.order.create({
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
      status: erpResult.error ? 'failed' : 'pending',
    },
  });

  if (erpResult.error) {
    await botSay(page.accessToken, psid, convId,
      'Түр зуурын саатал гарлаа. Оператортой холбогдоно уу.');
    await prisma.conversation.update({ where: { id: convId }, data: { isOperatorHandoff: true } });
    return;
  }

  const when = await getDeliveryMessage();
  const loc = [ctx.province, ctx.district, ctx.address].filter(Boolean).join(', ');
  const itemList = cart.map((c) => `${c.product.name} x ${c.quantity}ш`).join(', ');
  await botSay(page.accessToken, psid, convId,
    `Таны захиалга амжилттай бүртгэгдлээ!\n${itemList}\n${loc}-д ${when} хүргэнэ\nУдахгүй манай оператор тантай холбогдох болно. Баярлалаа!`);
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
    ctx.selectedProduct = product;
    await sendText(page.accessToken, psid,
      `${product.name}\nҮнэ: ${product.price.toLocaleString()}₮\nХэдэн ширхэг авах вэ?`,
      ['1', '2', '3', 'Өөр тоо']);
    await updateState(conv.id, 'QUANTITY', ctx);
  }
}
