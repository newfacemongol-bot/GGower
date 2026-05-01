import { NextResponse, type NextRequest } from 'next/server';
import { createSession, verifyPassword, SESSION_COOKIE_NAME } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const SESSION_DAYS = 7;

export async function POST(req: NextRequest) {
  const { password, role } = await req.json().catch(() => ({}));
  const r = role === 'operator' ? 'operator' : 'admin';
  if (!verifyPassword(password, r)) {
    return NextResponse.json({ error: 'Буруу нууц үг' }, { status: 401 });
  }
  const token = await createSession(r);
  const res = NextResponse.json({ ok: true, role: r });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return res;
}
