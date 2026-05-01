import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { sendText } from '@/lib/facebook';

export const dynamic = 'force-dynamic';

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const conv = await prisma.conversation.findUnique({
    where: { id: params.id },
    include: { page: { select: { accessToken: true } } },
  });
  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.conversation.update({
    where: { id: params.id },
    data: {
      state: 'IDLE',
      context: {},
      cart: [],
      isOperatorHandoff: false,
      misunderstandCount: 0,
      handoffReason: null,
      history: [],
    },
  });

  const welcome =
    'Сайн байна уу!\nЯмар бүтээгдэхүүн авахыг хүсч байна вэ?\nБүтээгдэхүүний код эсвэл нэрийг бичнэ үү.';
  if (conv.page?.accessToken) {
    await sendText(conv.page.accessToken, conv.psid, welcome).catch(() => {});
  }
  await prisma.message.create({
    data: {
      conversationId: params.id,
      text: welcome,
      isFromBot: true,
      isFromOperator: false,
    },
  });

  await prisma.auditLog.create({
    data: {
      entityType: 'conversation',
      entityId: params.id,
      action: 'reset',
      actorRole: s.role,
    },
  });

  return NextResponse.json({ ok: true });
}
