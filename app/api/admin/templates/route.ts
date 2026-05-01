import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const templates = await prisma.replyTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ useCount: 'desc' }, { createdAt: 'desc' }],
  });
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  if (!body.title || !body.text) {
    return NextResponse.json({ error: 'title_and_text_required' }, { status: 400 });
  }
  const t = await prisma.replyTemplate.create({
    data: {
      title: String(body.title).slice(0, 100),
      text: String(body.text).slice(0, 2000),
      shortcut: body.shortcut ? String(body.shortcut).slice(0, 20) : null,
    },
  });
  return NextResponse.json({ template: t });
}
