import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { cleanupLoadTestData } from '@/lib/load-tests';

export const dynamic = 'force-dynamic';

export async function POST() {
  const s = await getSession();
  if (!s || s.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const deleted = await cleanupLoadTestData();
  return NextResponse.json({ ok: true, deleted });
}
