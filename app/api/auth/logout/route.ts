import { NextResponse } from 'next/server';
import { clearSessionCookie, destroySession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  await destroySession();
  clearSessionCookie();
  return NextResponse.json({ ok: true });
}
