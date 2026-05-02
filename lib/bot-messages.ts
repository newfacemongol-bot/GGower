import { prisma } from './prisma';

export const BOT_MESSAGE_KEYS = [
  'welcome',
  'product_not_found',
  'ask_quantity',
  'ask_phone',
  'ask_extra_phone',
  'ask_province',
  'ask_district',
  'ask_address',
  'ask_note',
  'order_success',
  'order_fail',
  'operator_handoff',
  'session_timeout',
  'duplicate_order',
  'order_cancelled',
  'aimag_payment',
  'phone_received_ask_product',
] as const;

export type BotMessageKey = (typeof BOT_MESSAGE_KEYS)[number];

export const BOT_MESSAGE_DEFAULTS: Record<BotMessageKey, string> = {
  welcome: 'Сайн байна уу! 👋 Ямар бараа авахыг хүсч байна вэ? Бүтээгдэхүүний код эсвэл нэрийг бичнэ үү.',
  product_not_found: 'Уучлаарай, бүтээгдэхүүн олдсонгүй. Код эсвэл нэрийг шалгаад дахин бичнэ үү.',
  ask_quantity: 'Хэдэн ширхэг авах вэ?',
  ask_phone: 'Холбоо барих утасны дугаараа оруулна уу: (8 оронтой)',
  ask_extra_phone: 'Нэмэлт утасны дугаар байна уу?',
  ask_province: 'Хүргэлт хаашаа вэ?',
  ask_district: 'Аль дүүрэгт хүргэх вэ?',
  ask_address: 'Хүргүүлэх хаягаа бичнэ үү:\n(Дүүрэг, хороо, байр, тоот)',
  ask_note: 'Нэмэлт тэмдэглэл байна уу?',
  order_success: '✅ Таны захиалга амжилттай бүртгэгдлээ!\n📦 {productName} x {quantity}ш\n📍 {address}-д {deliveryTime} хүргэнэ\n📞 Хүргэлтийн өмнө холбоо барих болно\nБаярлалаа! 🙏',
  order_fail: '⚠️ Түр саатал. Оператор тантай холбогдох болно.',
  operator_handoff: 'Операторт холбож байна... ⏳ Удахгүй холбогдох болно.',
  session_timeout: 'Таны session дууссан. Шинээр эхлэхийн тулд "шинэ захиалга" гэж бичнэ үү.',
  duplicate_order: '⚠️ Энэ утасны дугаараар идэвхтэй захиалга байна. Оператор тантай холбогдох болно.',
  order_cancelled: 'Ойлголоо, захиалгыг цуцаллаа. Дахин захиалах бол мессеж илгээнэ үү 😊',
  aimag_payment: 'Орон нутгийн захиалгад урьдчилж төлбөр шилжүүлнэ үү. Оператор тантай холбогдох болно. Баярлалаа! 🙏',
  phone_received_ask_product: 'Ямар бараа авахыг хүсч байна вэ? 😊\nБүтээгдэхүүний код эсвэл нэрийг бичнэ үү.',
};

export const BOT_MESSAGE_LABELS: Record<BotMessageKey, string> = {
  welcome: 'Тавтай морилно уу',
  product_not_found: 'Бүтээгдэхүүн олдсонгүй',
  ask_quantity: 'Тоо ширхэг асуух',
  ask_phone: 'Утас асуух',
  ask_extra_phone: 'Нэмэлт утас асуух',
  ask_province: 'Аймаг/хот асуух',
  ask_district: 'Дүүрэг асуух',
  ask_address: 'Хаяг асуух',
  ask_note: 'Нэмэлт тэмдэглэл асуух',
  order_success: 'Захиалга амжилттай',
  order_fail: 'Захиалга амжилтгүй',
  operator_handoff: 'Операторт шилжүүлэх',
  session_timeout: 'Session дууссан',
  duplicate_order: 'Давхар захиалга',
  order_cancelled: 'Захиалга цуцалсан',
  aimag_payment: 'Орон нутгийн урьдчилгаа төлбөр',
  phone_received_ask_product: 'Утас хүлээн авсан / бараа асуух',
};

const CACHE_TTL_MS = 60_000;
const KEY_PREFIX = 'bot_msg_';

let cache: { data: Record<string, string>; expires: number } | null = null;

async function loadAll(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cache && cache.expires > now) return cache.data;

  const rows = await prisma.setting.findMany({
    where: { key: { startsWith: KEY_PREFIX } },
  });
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key.slice(KEY_PREFIX.length)] = r.value;
  }
  cache = { data: map, expires: now + CACHE_TTL_MS };
  return map;
}

export function invalidateBotMessageCache() {
  cache = null;
}

export async function getBotMessage(key: BotMessageKey): Promise<string> {
  const all = await loadAll();
  return all[key] ?? BOT_MESSAGE_DEFAULTS[key];
}

export async function getAllBotMessages(): Promise<Record<BotMessageKey, string>> {
  const all = await loadAll();
  const out = {} as Record<BotMessageKey, string>;
  for (const k of BOT_MESSAGE_KEYS) {
    out[k] = all[k] ?? BOT_MESSAGE_DEFAULTS[k];
  }
  return out;
}

export async function setBotMessage(key: BotMessageKey, value: string): Promise<void> {
  const storageKey = KEY_PREFIX + key;
  await prisma.setting.upsert({
    where: { key: storageKey },
    create: { key: storageKey, value },
    update: { value },
  });
  invalidateBotMessageCache();
}
