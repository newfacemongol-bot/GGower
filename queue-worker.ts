import { PrismaClient } from '@prisma/client';
import { replyToComment, reactToComment } from './lib/facebook';
import { pickRandomReply } from './lib/comment-filter';

const prisma = new PrismaClient();
const POLL_INTERVAL_MS = 5000;

async function getSetting(key: string, fallback: string): Promise<string> {
  const s = await prisma.setting.findUnique({ where: { key } });
  return s?.value ?? fallback;
}

async function isNightMode(): Promise<boolean> {
  const enabled = (await getSetting('night_mode_enabled', 'true')) === 'true';
  if (!enabled) return false;
  const start = parseInt(await getSetting('night_start_hour', '22'), 10);
  const end = parseInt(await getSetting('night_end_hour', '8'), 10);
  const h = new Date().getHours();
  if (start > end) return h >= start || h < end;
  return h >= start && h < end;
}

async function processOne() {
  const botEnabled = (await getSetting('bot_enabled', 'true')) === 'true';
  if (!botEnabled) return;
  if (await isNightMode()) return;

  const now = new Date();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const candidate = await prisma.commentLead.findFirst({
    where: {
      status: 'queued',
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
    },
    orderBy: { scheduledFor: 'asc' },
  });
  if (!candidate) return;

  const page = await prisma.facebookPage.findUnique({ where: { pageId: candidate.pageId } });
  if (!page || !page.isActive || !page.autoReplyEnabled) {
    await prisma.commentLead.update({ where: { id: candidate.id }, data: { status: 'skipped' } });
    return;
  }

  const sentThisHour = await prisma.commentLead.count({
    where: { pageId: page.pageId, status: 'sent', sentAt: { gte: hourAgo } },
  });
  if (sentThisHour >= page.hourlyCommentLimit) {
    await prisma.commentLead.update({
      where: { id: candidate.id },
      data: { scheduledFor: new Date(Date.now() + 60 * 60 * 1000) },
    });
    return;
  }

  const replies = await prisma.commentReply.findMany({ where: { isActive: true } });
  const replyText = pickRandomReply(replies.map((r) => r.text), candidate.senderName || undefined);

  const ok = await replyToComment(page.accessToken, candidate.commentId, replyText);

  if (page.reactionEnabled) {
    await reactToComment(page.accessToken, candidate.commentId).catch(() => false);
  }

  await prisma.commentLead.update({
    where: { id: candidate.id },
    data: {
      status: ok ? 'sent' : 'failed',
      replied: ok,
      repliedAt: ok ? new Date() : null,
      sentAt: ok ? new Date() : null,
      replyText,
    },
  });

  console.log(`[queue] ${ok ? 'sent' : 'failed'} reply to ${candidate.commentId} (${page.pageName})`);
}

async function main() {
  console.log('[queue-worker] starting; poll interval=', POLL_INTERVAL_MS, 'ms');
  while (true) {
    try {
      await processOne();
    } catch (e) {
      console.error('[queue-worker] error:', e);
    }
    await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
