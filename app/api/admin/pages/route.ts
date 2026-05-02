import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { setPersistentMenu } from '@/lib/facebook';

export const dynamic = 'force-dynamic';

async function auth() {
  const s = await getSession();
  return s && s.role === 'admin';
}

export async function GET() {
  if (!(await auth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const items = await prisma.facebookPage.findMany({
    orderBy: { createdAt: 'desc' },
    include: { erpConfig: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  if (!(await auth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const item = await prisma.facebookPage.create({
    data: {
      pageId: body.pageId,
      pageName: body.pageName,
      accessToken: body.accessToken,
      erpConfigId: body.erpConfigId || null,
      isActive: body.isActive ?? true,
      autoReplyEnabled: body.autoReplyEnabled ?? true,
      hourlyCommentLimit: body.hourlyCommentLimit ?? 60,
      reactionEnabled: body.reactionEnabled ?? false,
    },
  });
  // Best-effort: set persistent menu immediately when the page is registered.
  setPersistentMenu(item.accessToken).catch(() => undefined);
  return NextResponse.json({ item });
}
