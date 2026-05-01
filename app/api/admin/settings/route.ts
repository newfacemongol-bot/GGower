import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSettings, setSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';

async function auth() {
  const s = await getSession();
  return s && s.role === 'admin';
}

export async function GET() {
  if (!(await auth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const settings = await getSettings();
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  if (!(await auth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  for (const [k, v] of Object.entries(body.settings || {})) {
    await setSetting(k, String(v));
  }
  return NextResponse.json({ ok: true });
}
