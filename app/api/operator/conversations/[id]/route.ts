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
  const data: any = {};
  if (body.isOperatorHandoff !== undefined) data.isOperatorHandoff = body.isOperatorHandoff;
  if (body.status !== undefined) data.status = body.status;
  if (body.handoffReason !== undefined) data.handoffReason = body.handoffReason;
  const conv = await prisma.conversation.update({
    where: { id: params.id },
    data,
  });
  await prisma.auditLog.create({
    data: {
      entityType: 'conversation',
      entityId: params.id,
      action: 'updated',
      actorRole: s.role,
      meta: data as any,
    },
  });
  return NextResponse.json({ conversation: conv });
}
