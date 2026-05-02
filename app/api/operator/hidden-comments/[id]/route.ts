import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { hideComment, deleteComment } from '@/lib/facebook';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const lead = await prisma.commentLead.findUnique({ where: { id: params.id } });
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const page = await prisma.facebookPage.findUnique({ where: { pageId: lead.pageId } });
  if (!page) return NextResponse.json({ error: 'Page not found' }, { status: 404 });

  if (body.action === 'unhide') {
    const ok = await hideComment(page.accessToken, lead.commentId, false);
    await prisma.commentLead.update({
      where: { id: lead.id },
      data: { status: ok ? 'unhidden' : lead.status },
    });
    return NextResponse.json({ ok });
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const lead = await prisma.commentLead.findUnique({ where: { id: params.id } });
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const page = await prisma.facebookPage.findUnique({ where: { pageId: lead.pageId } });
  if (!page) return NextResponse.json({ error: 'Page not found' }, { status: 404 });

  const ok = await deleteComment(page.accessToken, lead.commentId);
  await prisma.commentLead.update({
    where: { id: lead.id },
    data: { status: ok ? 'deleted' : lead.status },
  });
  return NextResponse.json({ ok });
}
