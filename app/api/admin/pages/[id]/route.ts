import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function auth() {
  const s = await getSession();
  return s && s.role === 'admin';
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await auth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const data: any = {};
  if (body.pageName !== undefined) data.pageName = body.pageName;
  if (body.accessToken !== undefined && body.accessToken !== '') data.accessToken = body.accessToken;
  if (body.erpConfigId !== undefined) data.erpConfigId = body.erpConfigId || null;
  if (body.isActive !== undefined) data.isActive = body.isActive;
  if (body.autoReplyEnabled !== undefined) data.autoReplyEnabled = body.autoReplyEnabled;
  if (body.hourlyCommentLimit !== undefined) data.hourlyCommentLimit = body.hourlyCommentLimit;
  if (body.reactionEnabled !== undefined) data.reactionEnabled = body.reactionEnabled;
  const item = await prisma.facebookPage.update({ where: { id: params.id }, data });
  return NextResponse.json({ item });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await auth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const item = await prisma.facebookPage.update({
    where: { id: params.id },
    data: { isActive: false, autoReplyEnabled: false },
  });
  return NextResponse.json({ item });
}
