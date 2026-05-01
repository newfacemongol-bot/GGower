import { prisma } from './prisma';

export async function getSetting(key: string, defaultValue = ''): Promise<string> {
  const s = await prisma.setting.findUnique({ where: { key } });
  return s?.value ?? defaultValue;
}

export async function getSettings(): Promise<Record<string, string>> {
  const all = await prisma.setting.findMany();
  return Object.fromEntries(all.map((s) => [s.key, s.value]));
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function isBotEnabled(): Promise<boolean> {
  return (await getSetting('bot_enabled', 'true')) === 'true';
}

export async function isNightMode(): Promise<boolean> {
  const enabled = (await getSetting('night_mode_enabled', 'true')) === 'true';
  if (!enabled) return false;
  const start = parseInt(await getSetting('night_start_hour', '22'), 10);
  const end = parseInt(await getSetting('night_end_hour', '8'), 10);
  const hour = new Date().getHours();
  if (start > end) return hour >= start || hour < end;
  return hour >= start && hour < end;
}

export async function getDeliveryMessage(): Promise<string> {
  const start = parseInt(await getSetting('delivery_start_hour', '8'), 10);
  const end = parseInt(await getSetting('delivery_end_hour', '16'), 10);
  const hour = new Date().getHours();
  if (hour >= start && hour < end) return 'өнөөдөр';
  return 'маргааш';
}
