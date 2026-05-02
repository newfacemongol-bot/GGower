import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const leads = await prisma.commentLead.findMany({
    where: { status: 'negative_hidden' },
    orderBy: { queuedAt: 'desc' },
    take: 500,
    include: { page: { select: { pageName: true } } },
  });

  return NextResponse.json({
    count: leads.length,
    items: leads.map((l) => ({
      id: l.id,
      senderName: l.senderName,
      commentText: l.commentText,
      postId: l.postId,
      commentId: l.commentId,
      pageId: l.pageId,
      pageName: l.page?.pageName,
      queuedAt: l.queuedAt,
      postLink: l.postId ? `https://facebook.com/${l.postId}` : null,
      status: l.status,
    })),
  });
}
