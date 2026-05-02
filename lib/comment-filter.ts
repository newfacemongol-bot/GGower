const BOT_TEXTS = new Set(['test', '👍', '😍', '❤️', '🔥', 'ok', '+1']);

export function isSpamComment(text: string): boolean {
  const t = text.trim();
  if (t.length < 3) return true;
  if (BOT_TEXTS.has(t.toLowerCase())) return true;
  const emojiOnly = /^[\p{Emoji}\s]+$/u.test(t);
  if (emojiOnly) return true;
  return false;
}

export type CommentReplyCategory = 'interest' | 'product' | 'generic';

export function detectCommentCategory(text: string): CommentReplyCategory {
  const t = text.toLowerCase();
  if (/авъя|авья|авна|авмаар|захиал|интерест|interest|хэрэгтэй|авия|awii|avii|avya|zahial|хүсэж байна|хэрэгтэй байна|бол/.test(t)) {
    return 'interest';
  }
  return 'generic';
}

export const INTEREST_REPLY_TEMPLATES = [
  'Сайн байна уу {name}! 😊 Бид таны хүсэлтийг хүлээн авлаа. Удахгүй холбогдож захиалга авна. Баярлалаа! 🙏',
  'Сайн байна уу {name}! 🙏 Таны хүсэлтийг хүлээн авлаа, удахгүй холбогдох болно. Баярлалаа!',
  'Сайн байна уу {name} 😊 Хүсэлтийг тань авлаа. Оператор удахгүй холбогдож захиалга авна. 🙏',
  'Сайн байна уу {name}! Таны сонирхсон бүтээгдэхүүний талаар удахгүй холбогдоно. Баярлалаа 😊',
  '{name} сайн байна уу 🙏 Бид хүсэлтийг тань авлаа, удахгүй холбогдож захиалгыг баталгаажуулна.',
  'Сайн байна уу {name}! 😊 Хүсэлтийг хүлээн авлаа, манай оператор удахгүй холбогдоно. Баярлалаа!',
  'Сайн байна уу {name} 🙏 Захиалгын хүсэлтийг тань бүртгэж авлаа. Удахгүй холбогдоно.',
  '{name} та бүхэнд баярлалаа 😊 Хүсэлтийг хүлээн авлаа, удахгүй холбогдож захиалгыг авна.',
  'Сайн байна уу {name} 🙏 Таны хүсэлтийг авлаа. Манай оператор удахгүй тантай холбогдох болно. Баярлалаа!',
  'Сайн байна уу {name}! 🙏 Хүсэлтийг хүлээн авлаа, захиалгаа удахгүй баталгаажуулна. Баярлалаа 😊',
];

export const PRODUCT_REPLY_TEMPLATES = [
  'Сайн байна уу {name}! 😊 Та {product} захиалах бол манай page-д мессеж илгээнэ үү 📩\nХҮРГЭЛТ МАРГААШ 12:00-18:00 ЦАГТ',
  'Сайн байна уу {name} 🙏 {product}-г захиалахыг хүсвэл мессеж илгээнэ үү 📩\nХүргэлт: маргааш 12:00-18:00',
  '{name} сайн байна уу 😊 {product} захиалах бол page-д мессеж илгээнэ үү.\nХҮРГЭЛТ МАРГААШ 12:00-18:00',
  'Сайн байна уу {name}! {product}-г захиалахын тулд манай inbox-д мессеж илгээнэ үү 📩 Хүргэлт маргааш 12:00-18:00.',
  'Сайн байна уу {name} 🙏 {product} сонирхож байвал мессеж илгээнэ үү 📩\nХүргэлт: маргааш 12-18 цаг',
  '{name} та {product}-г захиалахыг хүсвэл манай page-д мессеж илгээнэ үү 😊 Хүргэлт маргааш 12:00-18:00 цагт.',
  'Сайн байна уу {name}! 📩 {product} захиалах бол бидэнд мессеж илгээнэ үү.\nХҮРГЭЛТ: МАРГААШ 12:00-18:00',
  'Сайн байна уу {name} 😊 {product}-ын талаар мессежээр холбогдоно уу 📩 Хүргэлт маргааш 12:00-18:00.',
  '{name} сайн байна уу 🙏 {product}-г авах бол мессеж илгээнэ үү. Хүргэлт маргааш 12:00-18:00 цагт.',
  'Сайн байна уу {name}! 🙏 {product} захиалахыг хүсвэл page-д мессеж илгээнэ үү 📩\nХүргэлт маргааш 12:00-18:00',
];

function interpolate(template: string, name: string, product: string): string {
  return template
    .replace(/\{name\}/g, name || '')
    .replace(/\{product\}/g, product || 'энэ бүтээгдэхүүн')
    .replace(/\s+/g, ' ')
    .trim();
}

export function pickRandomReply(replies: string[], name?: string, product?: string): string {
  const pool = replies.length ? replies : INTEREST_REPLY_TEMPLATES;
  const template = pool[Math.floor(Math.random() * pool.length)];
  return interpolate(template, name || '', product || '');
}

export function pickReplyByCategory(
  allReplies: { text: string; category: string }[],
  category: CommentReplyCategory,
  name?: string,
  product?: string,
): string {
  const filtered = allReplies.filter((r) => r.category === category).map((r) => r.text);
  const fallback = category === 'product' ? PRODUCT_REPLY_TEMPLATES : INTEREST_REPLY_TEMPLATES;
  const pool = filtered.length ? filtered : fallback;
  const template = pool[Math.floor(Math.random() * pool.length)];
  return interpolate(template, name || '', product || '');
}

export function randomDelayMs(): number {
  return 15000 + Math.floor(Math.random() * 45000);
}
