import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const conv = await prisma.conversation.findUnique({ where: { id: params.id } });
  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.spamBlock.deleteMany({ where: { psid: conv.psid, pageId: conv.pageId } });

  await prisma.conversation.update({
    where: { id: params.id },
    data: {
      state: 'IDLE',
      context: {},
      cart: [],
      isOperatorHandoff: false,
      handoffReason: null,
      misunderstandCount: 0,
    },
  });

  await prisma.auditLog.create({
    data: {
      entityType: 'conversation',
      entityId: params.id,
      action: 'unspam',
      actorRole: s.role,
    },
  });

  return NextResponse.json({ ok: true });
}
