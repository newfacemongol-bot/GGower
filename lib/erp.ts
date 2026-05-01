import { erpDb, resolveErpImageUrl } from './erp-db';

export interface ErpProduct {
  id: string;
  name: string;
  code: string;
  price: number;
  images?: string[];
  description?: string;
  stock?: number;
}

export interface ErpConfigShape {
  apiUrl: string;
  apiKey: string;
}

interface ProductRow {
  id: number;
  code: string;
  name: string;
  price: number;
  stock: number;
  image: string | null;
}

function rowToProduct(r: ProductRow): ErpProduct {
  return {
    id: String(r.id),
    code: r.code,
    name: r.name,
    price: r.price,
    stock: r.stock,
    images: r.image ? [resolveErpImageUrl(r.image) as string] : [],
  };
}

export async function erpTestConnection(_cfg: ErpConfigShape): Promise<{ ok: boolean; error?: string }> {
  try {
    await erpDb.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function erpSearchProducts(_cfg: ErpConfigShape, query: string, pageSize = 5): Promise<ErpProduct[]> {
  try {
    const like = `%${query}%`;
    const rows = await erpDb.$queryRaw<ProductRow[]>`
      SELECT id, code, name, price, stock, image
      FROM "Product"
      WHERE (name ILIKE ${like} OR code ILIKE ${like})
        AND active = true
      LIMIT ${pageSize}
    `;
    return rows.map(rowToProduct);
  } catch {
    return [];
  }
}

export async function erpGetProduct(_cfg: ErpConfigShape, id: string): Promise<ErpProduct | null> {
  try {
    const numericId = parseInt(id, 10);
    if (!Number.isFinite(numericId)) return null;
    const rows = await erpDb.$queryRaw<ProductRow[]>`
      SELECT id, code, name, price, stock, image
      FROM "Product"
      WHERE id = ${numericId} AND active = true
      LIMIT 1
    `;
    return rows[0] ? rowToProduct(rows[0]) : null;
  } catch {
    return null;
  }
}

export interface ErpOrderInput {
  customerPhone: string;
  extraPhone?: string;
  address: string;
  district?: string;
  province: string;
  shopSource: string;
  products: { productId: string; productName: string; price: number; quantity: number; code: string }[];
  customerName?: string;
  operatorNote?: string;
  chatbotOrderId?: string;
}

function generateOrderNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `chatbot-${y}${m}${d}-${rand}`;
}

export async function erpCreateOrder(
  _cfg: ErpConfigShape,
  input: ErpOrderInput,
): Promise<{ id?: string; orderNumber?: string; status?: string; error?: string }> {
  try {
    const dup = await erpCheckDuplicateOrder(input.customerPhone);
    if (dup) {
      return { error: 'DUPLICATE_ACTIVE_ORDER' };
    }

    const productsJson = input.products.map((p) => ({
      id: Number(p.productId) || p.productId,
      code: p.code,
      name: p.productName,
      price: p.price,
      quantity: p.quantity,
    }));
    const orderTotal = input.products.reduce((sum, p) => sum + p.price * p.quantity, 0);
    const historyJson = [
      { status: 'NEW', date: new Date().toISOString(), note: 'Chatbot захиалга' },
    ];

    const orderNumber = generateOrderNumber();

    const rows = await erpDb.$queryRaw<{ id: number; orderNumber: string; status: string }[]>`
      INSERT INTO "Order" (
        "orderNumber",
        "customerName",
        "customerPhone",
        "extraPhone",
        "address",
        "district",
        "province",
        "operatorNote",
        "opp",
        "shopSource",
        "status",
        "products",
        "history",
        "chatbotOrderId",
        "orderTotal"
      ) VALUES (
        ${orderNumber},
        ${input.customerName ?? null},
        ${input.customerPhone},
        ${input.extraPhone ?? null},
        ${input.address},
        ${input.district ?? null},
        ${input.province},
        ${input.operatorNote ?? null},
        ${'chatbot'},
        ${input.shopSource},
        ${'NEW'}::"OrderStatus",
        ${JSON.stringify(productsJson)}::jsonb,
        ${JSON.stringify(historyJson)}::jsonb,
        ${input.chatbotOrderId ?? null},
        ${orderTotal}
      )
      RETURNING id, "orderNumber", status::text AS status
    `;

    const created = rows[0];
    if (!created) return { error: 'INSERT_FAILED' };
    return {
      id: String(created.id),
      orderNumber: created.orderNumber,
      status: created.status,
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function erpCheckDuplicateOrder(phone: string): Promise<boolean> {
  try {
    const rows = await erpDb.$queryRaw<{ id: number }[]>`
      SELECT id FROM "Order"
      WHERE "customerPhone" = ${phone}
        AND status::text NOT IN ('CANCELLED', 'DELIVERED', 'PAYMENT_RECEIVED')
        AND "deletedAt" IS NULL
      LIMIT 1
    `;
    return rows.length > 0;
  } catch {
    return false;
  }
}

export async function erpSearchOrders(_cfg: ErpConfigShape, phone: string): Promise<any[]> {
  try {
    const rows = await erpDb.$queryRaw<any[]>`
      SELECT id, "orderNumber", status::text AS status, "createdAt"
      FROM "Order"
      WHERE "customerPhone" = ${phone}
        AND "deletedAt" IS NULL
      ORDER BY "createdAt" DESC
      LIMIT 10
    `;
    return rows.map((r) => ({
      id: String(r.id),
      orderNumber: r.orderNumber,
      status: r.status,
      createdAt: r.createdAt,
    }));
  } catch {
    return [];
  }
}
