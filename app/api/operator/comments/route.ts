import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100;

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status') || undefined;
  const hasPhone = url.searchParams.get('hasPhone');
  const archived = url.searchParams.get('archived') === '1';
  const search = (url.searchParams.get('search') ?? '').trim();
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);

  const where: any = {
    isArchived: archived,
    status: status || undefined,
    extractedPhone: hasPhone === '1' ? { not: null } : hasPhone === '0' ? null : undefined,
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
    include: { page: { select: { pageName: true } } },
    orderBy: { queuedAt: 'desc' },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return NextResponse.json({
    items: items.map((c) => ({
      id: c.id,
      commentText: c.commentText,
      senderName: c.senderName,
      pageId: c.pageId,
      pageName: c.page?.pageName,
      extractedPhone: c.extractedPhone,
      productCode: c.productCode,
      intent: c.intent,
      status: c.status,
      queuedAt: c.queuedAt,
      repliedAt: c.repliedAt,
      createdAt: c.createdAt,
      isArchived: c.isArchived,
      archivedAt: c.archivedAt,
    })),
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}
