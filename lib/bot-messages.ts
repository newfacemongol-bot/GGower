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
  'night_order_received',
  'morning_confirmation',
] as const;

export type BotMessageKey = (typeof BOT_MESSAGE_KEYS)[number];

export const BOT_MESSAGE_DEFAULTS: Record<BotMessageKey, string> = {
  welcome: 'Сайн байна уу! 👋\nЯмар бараа авахыг хүсч байна вэ?\nБүтээгдэхүүний код эсвэл нэрийг бичнэ үү.',
  product_not_found: 'Уучлаарай, бүтээгдэхүүн олдсонгүй 😔\nДахин код эсвэл нэрийг бичнэ үү.',
  ask_quantity: 'Хэдэн ширхэг авах вэ?',
  ask_phone: 'Холбоо барих утасны дугаараа оруулна уу:',
  ask_extra_phone: 'Нэмэлт утасны дугаар байна уу?\n(Байхгүй бол \'байхгүй\' гэж бичнэ үү)',
  ask_province: 'Хүргэлт хаашаа вэ?\n(Улаанбаатар эсвэл аймгийн нэр)',
  ask_district: 'Аль дүүрэгт хүргэх вэ?\n[БЗД] [БГД] [СХД] [СБД] [ХУД] [ЧД]',
  ask_address: 'Дэлгэрэнгүй хаягаа бичнэ үү:\n(Хороо, байр, тоот, орц, давхар)',
  ask_note: 'Нэмэлт тэмдэглэл байна уу?\n(Байхгүй бол \'байхгүй\' гэж бичнэ үү)',
  order_success: '✅ Таны захиалга амжилттай бүртгэгдлээ!\n📦 {productName} x {quantity}ш\n📍 {address}\n🚚 МАРГААШ 12:00-18:00 ЦАГИЙН ХООРОНД ХҮРГЭЖ ОЧНО\n📞 Хүргэлтийн өмнө холбоо барих болно\nБаярлалаа! 🙏',
  order_fail: '⚠️ Түр саатал. Оператор тантай холбогдох болно.',
  operator_handoff: 'Операторт холбож байна... ⏳\nУдахгүй холбогдох болно.',
  session_timeout: 'Таны session дууссан. Шинээр эхлэхийн тулд "шинэ захиалга" гэж бичнэ үү.',
  duplicate_order: '⚠️ Энэ утасны дугаараар идэвхтэй захиалга байна. Оператор тантай холбогдох болно.',
  order_cancelled: 'Ойлголоо, захиалгыг цуцаллаа.\nДахин захиалах бол мессеж илгээнэ үү 😊',
  aimag_payment: '✅ Таны захиалга бүртгэгдлээ!\n📦 {productName} x {quantity}ш\n🚚 Маргааш унаанд тавьж өгнө\n💳 Урьдчилж төлбөр шилжүүлнэ үү\n📞 Асуух зүйл: 77774090\nБаярлалаа! 🙏',
  phone_received_ask_product: 'Утасны дугаарыг хүлээн авлаа! 😊\nЯмар бараа авахыг хүсч байна вэ?\nБүтээгдэхүүний код эсвэл нэрийг бичнэ үү.',
  night_order_received: '✅ Таны захиалгыг хүлээн авлаа!\n📦 {productName} x {quantity}ш\n📍 {address}\n⏰ Өглөө таньтай холбогдох болно\nБаярлалаа! 🙏',
  morning_confirmation: '🌅 Өглөөний мэнд!\n✅ Таны захиалга баталгаажлаа!\n📦 {productName} x {quantity}ш\n📍 {address}\n🚚 МАРГААШ 12:00-18:00 ЦАГИЙН ХООРОНД ХҮРГЭЖ ОЧНО\n📞 Хүргэлтийн өмнө холбоо барих болно\nБаярлалаа! 🙏',
};

export const BOT_MESSAGE_LABELS: Record<BotMessageKey, string> = {
  welcome: 'Тавтай морилно уу / Welcome',
  product_not_found: 'Бүтээгдэхүүн олдсонгүй / Product not found',
  ask_quantity: 'Тоо ширхэг асуух / Ask quantity',
  ask_phone: 'Утас асуух / Ask phone',
  ask_extra_phone: 'Нэмэлт утас асуух / Ask extra phone',
  ask_province: 'Аймаг/хот асуух / Ask province or city',
  ask_district: 'Дүүрэг асуух / Ask district',
  ask_address: 'Хаяг асуух / Ask address',
  ask_note: 'Нэмэлт тэмдэглэл асуух / Ask additional note',
  order_success: 'Захиалга амжилттай / Order success',
  order_fail: 'Захиалга амжилтгүй / Order failed',
  operator_handoff: 'Операторт шилжүүлэх / Operator handoff',
  session_timeout: 'Session дууссан / Session timed out',
  duplicate_order: 'Давхар захиалга / Duplicate order',
  order_cancelled: 'Захиалга цуцалсан / Order cancelled',
  aimag_payment: 'Орон нутгийн урьдчилгаа төлбөр / Rural advance payment',
  phone_received_ask_product: 'Утас хүлээн авсан / бараа асуух / Phone received, ask product',
  night_order_received: 'Шөнийн захиалга хүлээн авсан / Night order received',
  morning_confirmation: 'Өглөөний баталгаажуулалт / Morning confirmation',
};

const CACHE_TTL_MS = 5_000;
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
