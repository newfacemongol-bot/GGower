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
  const item = await prisma.facebookPage.update({
    where: { id: params.id },
    data: {
      pageName: body.pageName,
      accessToken: body.accessToken,
      erpConfigId: body.erpConfigId ?? null,
      isActive: body.isActive,
      autoReplyEnabled: body.autoReplyEnabled,
      hourlyCommentLimit: body.hourlyCommentLimit,
      reactionEnabled: body.reactionEnabled,
    },
  });
  return NextResponse.json({ item });
}
