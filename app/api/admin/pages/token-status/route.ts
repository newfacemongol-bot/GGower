import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function checkToken(token: string): Promise<boolean> {
  try {
    const r = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${encodeURIComponent(token)}`, {
      cache: 'no-store',
    });
    if (!r.ok) return false;
    const d = await r.json().catch(() => ({}));
    return !d.error && !!d.id;
  } catch {
    return false;
  }
}

export async function GET() {
  const s = await getSession();
  if (!s || s.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const pages = await prisma.facebookPage.findMany({
    select: { id: true, pageId: true, pageName: true, accessToken: true, isActive: true },
  });

  const results = await Promise.all(
    pages.map(async (p) => ({
      id: p.id,
      pageId: p.pageId,
      pageName: p.pageName,
      isActive: p.isActive,
      valid: await checkToken(p.accessToken),
    })),
  );

  return NextResponse.json({ items: results });
}
