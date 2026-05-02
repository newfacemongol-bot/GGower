import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const hoursParam = parseInt(url.searchParams.get('hours') ?? '16', 10);
  const hours = Number.isFinite(hoursParam) && hoursParam > 0 && hoursParam <= 168 ? hoursParam : 16;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const leads = await prisma.commentLead.findMany({
    where: {
      extractedPhone: { not: null },
      queuedAt: { gte: since },
    },
    orderBy: { queuedAt: 'desc' },
    take: 500,
    include: { page: { select: { pageName: true } } },
  });

  return NextResponse.json({
    hours,
    count: leads.length,
    items: leads.map((l) => ({
      id: l.id,
      senderName: l.senderName,
      phone: l.extractedPhone,
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
