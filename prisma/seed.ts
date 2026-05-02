import { PrismaClient } from '@prisma/client';
import { INTEREST_REPLY_TEMPLATES, PRODUCT_REPLY_TEMPLATES } from '../lib/comment-filter';
import { BOT_MESSAGE_DEFAULTS, BOT_MESSAGE_KEYS } from '../lib/bot-messages';

const prisma = new PrismaClient();

const LEGACY_BOT_MESSAGES: Record<string, string[]> = {
  welcome: [
    'Сайн байна уу! 👋 Ямар бараа авахыг хүсч байна вэ? Бүтээгдэхүүний код эсвэл нэрийг бичнэ үү.',
  ],
  product_not_found: [
    'Уучлаарай, бүтээгдэхүүн олдсонгүй. Код эсвэл нэрийг шалгаад дахин бичнэ үү.',
  ],
  ask_phone: [
    'Холбоо барих утасны дугаараа оруулна уу: (8 оронтой)',
  ],
  ask_extra_phone: [
    'Нэмэлт утасны дугаар байна уу?',
  ],
  ask_province: [
    'Хүргэлт хаашаа вэ?',
  ],
  ask_district: [
    'Аль дүүрэгт хүргэх вэ?',
  ],
  ask_note: [
    'Нэмэлт тэмдэглэл байна уу?',
  ],
  order_success: [
    '✅ Таны захиалга амжилттай бүртгэгдлээ!\n📦 {productName} x {quantity}ш\n📍 {address}-д {deliveryTime} хүргэнэ\n📞 Хүргэлтийн өмнө холбоо барих болно\nБаярлалаа! 🙏',
  ],
  operator_handoff: [
    'Операторт холбож байна... ⏳ Удахгүй холбогдох болно.',
  ],
  order_cancelled: [
    'Ойлголоо, захиалгыг цуцаллаа. Дахин захиалах бол мессеж илгээнэ үү 😊',
  ],
  aimag_payment: [
    'Орон нутгийн захиалгад урьдчилж төлбөр шилжүүлнэ үү. Оператор тантай холбогдох болно. Баярлалаа! 🙏',
  ],
  phone_received_ask_product: [
    'Ямар бараа авахыг хүсч байна вэ? 😊\nБүтээгдэхүүний код эсвэл нэрийг бичнэ үү.',
  ],
};

const DEFAULT_SETTINGS: Record<string, string> = {
  bot_enabled: 'true',
  delivery_start_hour: '8',
  delivery_end_hour: '16',
  night_mode_enabled: 'true',
  night_start_hour: '22',
  night_end_hour: '8',
  reaction_enabled: 'false',
  hourly_comment_limit: '60',
};

const DEFAULT_REPLIES = [
  'Сайн байна уу {name}! Захиалга өгөхийн тулд манай page-д мессеж илгээнэ үү.',
  'Сайн байна уу! Бүтээгдэхүүний талаар мессежээр холбогдоно уу.',
  'Та манай page-д мессеж илгээвэл захиалгаа өгч болно.',
  'Сайн байна уу {name}! Манай page-д мессеж илгээгээрэй.',
  'Сайн байна уу! Захиалгын талаар мессеж илгээнэ үү.',
  'Та бидэнтэй мессежээр холбогдвол захиалга өгч болно.',
  'Сайн байна уу {name}! Манай page-д мессеж илгээж захиалга өгнө үү.',
  'Сайн байна уу! Мессеж илгээнэ үү, тантай холбогдоно.',
  'Та мессеж илгээвэл бид нэн даруй хариу өгөх болно.',
  'Сайн байна уу {name}! Захиалга өгөхийн тулд мессеж илгээнэ үү.',
];

async function main() {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: {},
    });
  }

  const count = await prisma.commentReply.count();
  if (count === 0) {
    for (const text of DEFAULT_REPLIES) {
      await prisma.commentReply.create({ data: { text, category: 'generic' } });
    }
  }

  const interestCount = await prisma.commentReply.count({ where: { category: 'interest' } });
  if (interestCount === 0) {
    for (const text of INTEREST_REPLY_TEMPLATES) {
      await prisma.commentReply.create({ data: { text, category: 'interest' } });
    }
  }
  const productCount = await prisma.commentReply.count({ where: { category: 'product' } });
  if (productCount === 0) {
    for (const text of PRODUCT_REPLY_TEMPLATES) {
      await prisma.commentReply.create({ data: { text, category: 'product' } });
    }
  }

  for (const key of BOT_MESSAGE_KEYS) {
    const storageKey = 'bot_msg_' + key;
    const newDefault = BOT_MESSAGE_DEFAULTS[key];
    const existing = await prisma.setting.findUnique({ where: { key: storageKey } });
    if (!existing) {
      await prisma.setting.create({ data: { key: storageKey, value: newDefault } });
      continue;
    }
    const legacy = LEGACY_BOT_MESSAGES[key] ?? [];
    if (legacy.includes(existing.value) && existing.value !== newDefault) {
      await prisma.setting.update({ where: { key: storageKey }, data: { value: newDefault } });
    }
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
