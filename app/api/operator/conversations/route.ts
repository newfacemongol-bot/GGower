import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const items = await prisma.conversation.findMany({
    orderBy: [{ lastMessageAt: 'desc' }],
    take: 200,
    include: {
      page: { select: { pageName: true } },
      messages: { orderBy: { timestamp: 'desc' }, take: 1 },
    },
  });
  const sentimentRank: Record<string, number> = { urgent: 0, complaint: 1, negative: 2, neutral: 3 };
  items.sort((a, b) => {
    const ra = sentimentRank[a.sentiment] ?? 3;
    const rb = sentimentRank[b.sentiment] ?? 3;
    if (ra !== rb) return ra - rb;
    return b.lastMessageAt.getTime() - a.lastMessageAt.getTime();
  });
  const psids = items.map((c) => c.psid);
  const spamBlocks = psids.length
    ? await prisma.spamBlock.findMany({ where: { psid: { in: psids } } })
    : [];
  const spamSet = new Set(spamBlocks.map((b) => `${b.pageId}:${b.psid}`));
  return NextResponse.json({
    items: items.map((c) => ({
      id: c.id,
      psid: c.psid,
      senderName: c.senderName,
      pageName: c.page?.pageName,
      state: c.state,
      isOperatorHandoff: c.isOperatorHandoff,
      unreadCount: c.unreadCount,
      lastMessageAt: c.lastMessageAt,
      lastMessage: c.messages[0]?.text,
      status: c.status,
      sentiment: c.sentiment,
      isSpam: spamSet.has(`${c.pageId}:${c.psid}`),
    })),
  });
}
