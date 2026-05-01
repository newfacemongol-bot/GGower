import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const pageId = url.searchParams.get('pageId') || undefined;
  const status = url.searchParams.get('status') || undefined;
  const phone = url.searchParams.get('phone') || undefined;

  const items = await prisma.commentLead.findMany({
    where: {
      pageId: pageId || undefined,
      status: status || undefined,
      extractedPhone: phone || undefined,
    },
    orderBy: { queuedAt: 'desc' },
    take: 200,
  });
  return NextResponse.json({ items });
}
