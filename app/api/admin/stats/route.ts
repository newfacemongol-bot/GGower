import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await getSession();
  if (!s || s.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const nowMs = Date.now();
  const last5min = new Date(nowMs - 5 * 60 * 1000);
  const windowOpenSince = new Date(nowMs - 24 * 60 * 60 * 1000);
  const closeIn2hStart = new Date(nowMs - 24 * 60 * 60 * 1000);
  const closeIn2hEnd = new Date(nowMs - 22 * 60 * 60 * 1000);
  const closeIn30mStart = new Date(nowMs - 24 * 60 * 60 * 1000);
  const closeIn30mEnd = new Date(nowMs - 23.5 * 60 * 60 * 1000);

  const [
    todayOrders,
    todayOrdersFailed,
    totalComments,
    repliedComments,
    pendingChats,
    queuedComments,
    pages,
    todayConvs,
    todayCompletedOrders,
    activeNow,
    failedOrders,
    abandonedCarts,
    spamBlocked,
    complaintCount,
    urgentCount,
    windowClosingIn2h,
    windowClosingIn30m,
    windowExpired,
  ] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.order.count({ where: { createdAt: { gte: startOfDay }, status: 'failed' } }),
    prisma.commentLead.count({ where: { queuedAt: { gte: startOfDay } } }),
    prisma.commentLead.count({ where: { repliedAt: { gte: startOfDay } } }),
    prisma.conversation.count({ where: { isOperatorHandoff: true, status: 'active' } }),
    prisma.commentLead.count({ where: { status: 'queued' } }),
    prisma.facebookPage.findMany({
      include: {
        _count: { select: { comments: true, conversations: true } },
      },
    }),
    prisma.conversation.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.order.count({ where: { createdAt: { gte: startOfDay }, status: { not: 'failed' } } }),
    prisma.conversation.count({ where: { lastMessageAt: { gte: last5min } } }),
    prisma.order.count({ where: { status: 'failed' } }),
    prisma.conversation.count({ where: { abandonedAt: { not: null }, state: 'CONFIRM' } }),
    prisma.spamBlock.count(),
    prisma.conversation.count({ where: { sentiment: 'complaint', status: 'active' } }),
    prisma.conversation.count({ where: { sentiment: 'urgent', status: 'active' } }),
    prisma.conversation.count({
      where: {
        status: 'active',
        lastMessageAt: { gte: closeIn2hStart, lt: closeIn2hEnd },
      },
    }),
    prisma.conversation.count({
      where: {
        status: 'active',
        lastMessageAt: { gte: closeIn30mStart, lt: closeIn30mEnd },
      },
    }),
    prisma.conversation.count({
      where: {
        status: 'active',
        lastMessageAt: { lt: windowOpenSince },
      },
    }),
  ]);

  const conversionRate = todayConvs > 0 ? Math.round((todayCompletedOrders / todayConvs) * 1000) / 10 : 0;

  return NextResponse.json({
    todayOrders,
    todayOrdersFailed,
    totalComments,
    repliedComments,
    pendingChats,
    queuedComments,
    activeNow,
    failedOrders,
    abandonedCarts,
    spamBlocked,
    complaintCount,
    urgentCount,
    conversionRate,
    windowClosingIn2h,
    windowClosingIn30m,
    windowExpired,
    todayConvs,
    todayCompletedOrders,
    pages: pages.map((p) => ({
      pageId: p.pageId,
      pageName: p.pageName,
      comments: p._count.comments,
      conversations: p._count.conversations,
    })),
  });
}
