import { prisma } from './prisma';
import { setPersistentMenu } from './facebook';

const DEFAULT_SETTINGS: Record<string, string> = {
  bot_enabled: 'true',
  night_mode_enabled: 'true',
  night_start_hour: '22',
  night_end_hour: '9',
  hourly_comment_limit: '40',
  daily_comment_limit: '500',
  auto_reply_enabled: 'true',
  hourlyCommentLimit: '40',
  nightModeEnabled: 'true',
  nightModeStart: '22',
  nightModeEnd: '9',
  botEnabled: 'true',
  autoReplyEnabled: 'true',
  dailyCommentLimit: '500',
};

let defaultsEnsured = false;
export async function ensureDefaultSettings(): Promise<void> {
  if (defaultsEnsured) return;
  try {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await prisma.setting.upsert({
        where: { key },
        create: { key, value },
        update: {},
      });
    }
    defaultsEnsured = true;
    // Best-effort: configure persistent menu for every active page once at startup.
    try {
      const activePages = await prisma.facebookPage.findMany({ where: { isActive: true } });
      for (const p of activePages) {
        setPersistentMenu(p.accessToken).catch(() => undefined);
      }
    } catch {
      /* ignore */
    }
  } catch {
    /* swallow - don't break startup on transient DB errors */
  }
}

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
