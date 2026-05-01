import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status') || undefined;
  const hasPhone = url.searchParams.get('hasPhone');

  const items = await prisma.commentLead.findMany({
    where: {
      status: status || undefined,
      extractedPhone: hasPhone === '1' ? { not: null } : hasPhone === '0' ? null : undefined,
    },
    include: { page: { select: { pageName: true } } },
    orderBy: { queuedAt: 'desc' },
    take: 200,
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
    })),
  });
}
