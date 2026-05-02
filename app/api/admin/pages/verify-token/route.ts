import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function verifyToken(token: string): Promise<{ ok: boolean; name?: string; id?: string; error?: string }> {
  try {
    const r = await fetch(`https://graph.facebook.com/me?access_token=${encodeURIComponent(token)}`, {
      cache: 'no-store',
    });
    const d = await r.json().catch(() => ({}));
    if (d?.error || !d?.id) {
      return { ok: false, error: d?.error?.message || 'Token хүчингүй' };
    }
    return { ok: true, name: d.name, id: d.id };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Холбогдсонгүй' };
  }
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { accessToken } = await req.json().catch(() => ({}));
  if (!accessToken) return NextResponse.json({ ok: false, error: 'Токен хоосон' }, { status: 400 });
  const res = await verifyToken(accessToken);
  return NextResponse.json(res);
}
