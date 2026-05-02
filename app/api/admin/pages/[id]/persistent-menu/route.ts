import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { setPersistentMenu } from '@/lib/facebook';

export const dynamic = 'force-dynamic';

async function auth() {
  const s = await getSession();
  return s && s.role === 'admin';
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await auth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const page = await prisma.facebookPage.findUnique({ where: { id: params.id } });
  if (!page) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const result = await setPersistentMenu(page.accessToken);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
