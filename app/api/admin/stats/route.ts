import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await getSession();
  if (!s || s.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [todayOrders, totalComments, repliedComments, pendingChats, queuedComments, pages] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.commentLead.count({ where: { queuedAt: { gte: startOfDay } } }),
    prisma.commentLead.count({ where: { repliedAt: { gte: startOfDay } } }),
    prisma.conversation.count({ where: { isOperatorHandoff: true, status: 'active' } }),
    prisma.commentLead.count({ where: { status: 'queued' } }),
    prisma.facebookPage.findMany({
      include: {
        _count: { select: { comments: true, conversations: true } },
      },
    }),
  ]);

  return NextResponse.json({
    todayOrders,
    totalComments,
    repliedComments,
    pendingChats,
    queuedComments,
    pages: pages.map((p) => ({
      pageId: p.pageId,
      pageName: p.pageName,
      comments: p._count.comments,
      conversations: p._count.conversations,
    })),
  });
}
