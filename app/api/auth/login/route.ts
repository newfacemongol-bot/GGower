import { NextResponse, type NextRequest } from 'next/server';
import { createSession, setSessionCookie, verifyPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { password, role } = await req.json().catch(() => ({}));
  const r = role === 'operator' ? 'operator' : 'admin';
  if (!verifyPassword(password, r)) {
    return NextResponse.json({ error: 'Буруу нууц үг' }, { status: 401 });
  }
  const token = await createSession(r);
  setSessionCookie(token);
  return NextResponse.json({ ok: true, role: r });
}
