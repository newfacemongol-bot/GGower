import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { cleanupCommentStressData } from '@/lib/comment-stress-tests';

export const dynamic = 'force-dynamic';

export async function POST() {
  const s = await getSession();
  if (!s || s.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const deleted = await cleanupCommentStressData();
  return NextResponse.json({ ok: true, deleted });
}
