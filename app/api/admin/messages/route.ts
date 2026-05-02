import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  BOT_MESSAGE_KEYS,
  BOT_MESSAGE_LABELS,
  BOT_MESSAGE_DEFAULTS,
  getAllBotMessages,
  setBotMessage,
  invalidateBotMessageCache,
  type BotMessageKey,
} from '@/lib/bot-messages';

export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await getSession();
  if (!s || s.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const values = await getAllBotMessages();
  const items = BOT_MESSAGE_KEYS.map((key) => ({
    key,
    label: BOT_MESSAGE_LABELS[key],
    value: values[key],
    defaultValue: BOT_MESSAGE_DEFAULTS[key],
  }));
  return NextResponse.json({ items });
}

export async function PUT(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const updates: { key: BotMessageKey; value: string }[] = Array.isArray(body?.items) ? body.items : [];
  const validKeys = new Set<string>(BOT_MESSAGE_KEYS);
  for (const u of updates) {
    if (!validKeys.has(u.key)) continue;
    if (typeof u.value !== 'string') continue;
    await setBotMessage(u.key, u.value);
  }
  invalidateBotMessageCache();
  return NextResponse.json({ ok: true });
}
