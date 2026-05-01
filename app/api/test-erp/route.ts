import { NextResponse } from 'next/server';
import { erpDb } from '@/lib/erp-db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await erpDb.$queryRaw<
      { id: number; code: string; name: string; price: number; stock: number; image: string | null; active: boolean }[]
    >`
      SELECT id, code, name, price, stock, image, active
      FROM "Product"
      LIMIT 3
    `;
    return NextResponse.json({ ok: true, count: rows.length, products: rows });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
