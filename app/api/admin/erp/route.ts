import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

async function requireAdmin() {
  const s = await getSession();
  if (!s || s.role !== 'admin') return false;
  return true;
}

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const items = await prisma.erpConfig.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const item = await prisma.erpConfig.create({
    data: {
      name: body.name,
      apiUrl: body.apiUrl,
      apiKey: body.apiKey,
      description: body.description,
      isActive: body.isActive ?? true,
    },
  });
  return NextResponse.json({ item });
}
