import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
      await prisma.commentReply.create({ data: { text } });
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
