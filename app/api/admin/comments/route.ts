import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100;

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const pageId = url.searchParams.get('pageId') || undefined;
  const status = url.searchParams.get('status') || undefined;
  const phone = url.searchParams.get('phone') || undefined;
  const archived = url.searchParams.get('archived') === '1';
  const search = (url.searchParams.get('search') ?? '').trim();
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);

  const where: any = {
    pageId: pageId || undefined,
    status: status || undefined,
    extractedPhone: phone || undefined,
    isArchived: archived,
  };
  if (search) {
    where.OR = [
      { commentText: { contains: search, mode: 'insensitive' } },
      { senderName: { contains: search, mode: 'insensitive' } },
      { extractedPhone: { contains: search } },
    ];
  }

  const total = await prisma.commentLead.count({ where });

  const items = await prisma.commentLead.findMany({
    where,
    orderBy: { queuedAt: 'desc' },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return NextResponse.json({
    items,
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}
