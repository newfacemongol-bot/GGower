import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const items = await prisma.conversation.findMany({
    orderBy: { lastMessageAt: 'desc' },
    take: 200,
    include: {
      page: { select: { pageName: true } },
      messages: { orderBy: { timestamp: 'desc' }, take: 1 },
    },
  });
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
    })),
  });
}
