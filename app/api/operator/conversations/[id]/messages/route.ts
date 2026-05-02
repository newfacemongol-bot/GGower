import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { sendText } from '@/lib/facebook';
import { isWindowClosed, msRemaining } from '@/lib/fb-window';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { text } = await req.json();
  if (!text) return NextResponse.json({ error: 'Missing text' }, { status: 400 });

  const conv = await prisma.conversation.findUnique({
    where: { id: params.id },
    include: { page: true },
  });
  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (isWindowClosed(conv.lastMessageAt)) {
    return NextResponse.json(
      {
        error: 'WINDOW_EXPIRED',
        message: '24 цагийн цонх хэтэрсэн байна. Meta Business Suite-р орж бичнэ үү.',
        remainingMs: 0,
      },
      { status: 403 },
    );
  }

  await sendText(conv.page.accessToken, conv.psid, text);
  const msg = await prisma.message.create({
    data: { conversationId: conv.id, text, isFromOperator: true },
  });
  await prisma.conversation.update({
    where: { id: conv.id },
    data: { isOperatorHandoff: true, lastMessageAt: new Date() },
  });
  return NextResponse.json({ message: msg, remainingMs: msRemaining(conv.lastMessageAt) });
}
