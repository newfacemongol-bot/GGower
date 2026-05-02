import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100;

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const archived = url.searchParams.get('archived') === '1';
  const search = (url.searchParams.get('search') ?? '').trim();

  const where: any = { isArchived: archived };
  if (search) {
    where.OR = [
      { senderName: { contains: search, mode: 'insensitive' } },
      { psid: { contains: search } },
    ];
  }

  const total = await prisma.conversation.count({ where });

  const items = await prisma.conversation.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { lastMessageAt: 'desc' }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      page: { select: { pageName: true } },
      messages: { orderBy: { timestamp: 'desc' }, take: 1 },
      orders: {
        where: { erpOrderId: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          erpOrderId: true,
          erpOrderNumber: true,
          products: true,
          address: true,
          createdAt: true,
          customerPhone: true,
        },
      },
    },
  });

  const sentimentRank: Record<string, number> = { urgent: 0, complaint: 1, negative: 2, neutral: 3 };
  items.sort((a, b) => {
    const ra = sentimentRank[a.sentiment] ?? 3;
    const rb = sentimentRank[b.sentiment] ?? 3;
    if (ra !== rb) return ra - rb;
    return b.lastMessageAt.getTime() - a.lastMessageAt.getTime();
  });

  const psids = items.map((c) => c.psid);
  const spamBlocks = psids.length
    ? await prisma.spamBlock.findMany({ where: { psid: { in: psids } } })
    : [];
  const spamSet = new Set(spamBlocks.map((b) => `${b.pageId}:${b.psid}`));

  return NextResponse.json({
    items: items.map((c) => {
      const ctx = (c.context as any) || {};
      const order = c.orders?.[0] || null;
      const products = order?.products as any[] | undefined;
      return {
        id: c.id,
        psid: c.psid,
        senderName: c.senderName,
        pageName: c.page?.pageName,
        state: c.state,
        isOperatorHandoff: c.isOperatorHandoff,
        misunderstandCount: c.misunderstandCount,
        unreadCount: c.unreadCount,
        lastMessageAt: c.lastMessageAt,
        lastMessage: c.messages[0]?.text,
        status: c.status,
        sentiment: c.sentiment,
        isArchived: c.isArchived,
        archivedAt: c.archivedAt,
        isSpam: spamSet.has(`${c.pageId}:${c.psid}`),
        hasPhone: !!ctx.phone,
        hasAddress: !!ctx.address,
        hasProduct: !!ctx.selectedProduct || !!ctx.productCode,
        phone: ctx.phone || null,
        address: ctx.address || null,
        productName: ctx.selectedProduct?.name || products?.[0]?.productName || null,
        order: order
          ? {
              id: order.id,
              erpOrderId: order.erpOrderId,
              erpOrderNumber: order.erpOrderNumber,
              createdAt: order.createdAt,
              address: order.address,
              phone: order.customerPhone,
              productName: products?.[0]?.productName || null,
            }
          : null,
      };
    }),
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}
