import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function auth() {
  const s = await getSession();
  return s && s.role === 'admin';
}

export async function GET() {
  if (!(await auth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const items = await prisma.commentReply.findMany({ orderBy: { createdAt: 'asc' } });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  if (!(await auth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const item = await prisma.commentReply.create({
    data: { text: body.text, isActive: body.isActive ?? true, category: body.category ?? 'generic' },
  });
  return NextResponse.json({ item });
}
