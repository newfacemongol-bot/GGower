import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const data: any = {};
  if (body.title !== undefined) data.title = String(body.title).slice(0, 100);
  if (body.text !== undefined) data.text = String(body.text).slice(0, 2000);
  if (body.shortcut !== undefined) data.shortcut = body.shortcut ? String(body.shortcut).slice(0, 20) : null;
  if (body.isActive !== undefined) data.isActive = !!body.isActive;
  if (body.incrementUse) data.useCount = { increment: 1 };
  const t = await prisma.replyTemplate.update({ where: { id: params.id }, data });
  return NextResponse.json({ template: t });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await prisma.replyTemplate.update({ where: { id: params.id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
