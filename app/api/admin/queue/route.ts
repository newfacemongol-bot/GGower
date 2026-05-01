import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await getSession();
  if (!s || s.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const items = await prisma.commentLead.findMany({
    where: { status: 'queued' },
    orderBy: { scheduledFor: 'asc' },
    take: 200,
  });
  const pages = await prisma.facebookPage.findMany({
    select: { pageId: true, pageName: true, hourlyCommentLimit: true },
  });
  return NextResponse.json({ items, pages });
}
