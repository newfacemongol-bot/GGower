import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const conv = await prisma.conversation.findUnique({
    where: { id: params.id },
    include: {
      messages: { orderBy: { timestamp: 'asc' } },
      page: { select: { pageName: true, accessToken: true } },
      orders: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.conversation.update({ where: { id: params.id }, data: { unreadCount: 0 } });
  return NextResponse.json({ conversation: conv });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const conv = await prisma.conversation.update({
    where: { id: params.id },
    data: {
      isOperatorHandoff: body.isOperatorHandoff,
      status: body.status,
    },
  });
  return NextResponse.json({ conversation: conv });
}
