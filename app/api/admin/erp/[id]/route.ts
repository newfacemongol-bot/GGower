import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { erpTestConnection } from '@/lib/erp';

export const dynamic = 'force-dynamic';

async function auth() {
  const s = await getSession();
  return s && s.role === 'admin';
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await auth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const item = await prisma.erpConfig.update({
    where: { id: params.id },
    data: {
      name: body.name,
      apiUrl: body.apiUrl,
      apiKey: body.apiKey,
      description: body.description,
      isActive: body.isActive,
    },
  });
  return NextResponse.json({ item });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await auth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  if (url.searchParams.get('action') === 'test') {
    const cfg = await prisma.erpConfig.findUnique({ where: { id: params.id } });
    if (!cfg) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const result = await erpTestConnection({ apiUrl: cfg.apiUrl, apiKey: cfg.apiKey });
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
