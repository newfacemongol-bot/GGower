import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED_STATUSES = new Set(['CALLED', 'CONFIRMED', 'NOT_INTERESTED']);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const status = String(body.status || '');
  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const item = await prisma.commentLead.update({
    where: { id: params.id },
    data: { status },
  });
  return NextResponse.json({ item });
}
