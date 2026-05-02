import { erpDb, resolveErpImageUrl } from './erp-db';
import { isStressTestMode } from './stress-test-mode';

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
  if (isStressTestMode()) {
    const q = query.trim().toUpperCase();
    if (q === '0116' || q === 'P-0116' || q === '116') {
      return [{ id: 'stress-116', code: '0116', name: 'Stress Test Product', price: 10000, stock: 100, images: [] }];
    }
    if (q === '0117' || q === 'P-0117') {
      return [{ id: 'stress-117', code: 'P-0117', name: 'Stress Test Product 2', price: 15000, stock: 50, images: [] }];
    }
  }
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
  if (isStressTestMode()) {
    console.log('[erpCreateOrder] STRESS TEST - order not created in ERP', {
      phone: input.customerPhone,
      chatbotOrderId: input.chatbotOrderId,
    });
    return { id: 'test-999', orderNumber: 'stress-test-001', status: 'NEW' };
  }
  try {
    if (!input.customerPhone || !input.address || !input.province) {
      console.error('[erpCreateOrder] Missing required fields', {
        customerPhone: !!input.customerPhone,
        address: !!input.address,
        province: !!input.province,
      });
      return { error: 'MISSING_REQUIRED_FIELDS' };
    }
    if (!input.products || input.products.length === 0) {
      console.error('[erpCreateOrder] No products provided');
      return { error: 'NO_PRODUCTS' };
    }

    const dup = await erpCheckDuplicateOrder(input.customerPhone);
    if (dup) {
      console.warn('[erpCreateOrder] Duplicate active order for phone', input.customerPhone);
      return { error: 'DUPLICATE_ACTIVE_ORDER' };
    }

    const productsJson = input.products.map((p) => ({
      id: Number(p.productId) || p.productId,
      code: p.code,
      name: p.productName,
      price: p.price,
      quantity: p.quantity,
    }));
    const orderTotal = input.products.reduce((sum, p) => sum + Math.round(p.price * p.quantity), 0);
    const historyJson = [
      { status: 'NEW', date: new Date().toISOString(), note: 'Chatbot захиалга' },
    ];

    const orderNumber = generateOrderNumber();
    const shopSource = input.shopSource || 'Facebook chatbot';
    const customerName = (input.customerName && input.customerName.trim()) || input.customerPhone;
    const addressSafe = (input.address && input.address.trim()) || '-';
    const provinceSafe = (input.province && input.province.trim()) || 'Улаанбаатар';
    const opp = 'chatbot';

    console.log('[erpCreateOrder] Inserting order', {
      orderNumber,
      customerPhone: input.customerPhone,
      province: input.province,
      productsCount: productsJson.length,
      orderTotal,
    });

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
        "orderTotal",
        "isPaidToDriver",
        "goodsReturned",
        "driverSalary",
        "rescheduleCount",
        "prepaid",
        "customOrder",
        "excludedFromPerformance",
        "cancelledProductsReturnedToWarehouse",
        "rescheduledProductsReturnedToWarehouse",
        "updatedAt"
      ) VALUES (
        ${orderNumber},
        ${customerName},
        ${input.customerPhone},
        ${input.extraPhone ?? null},
        ${addressSafe},
        ${input.district ?? null},
        ${provinceSafe},
        ${input.operatorNote ?? null},
        ${opp},
        ${shopSource},
        ${'NEW'}::"OrderStatus",
        ${JSON.stringify(productsJson)}::jsonb,
        ${JSON.stringify(historyJson)}::jsonb,
        ${input.chatbotOrderId ?? null},
        ${orderTotal},
        ${true},
        ${0},
        ${0},
        ${0},
        ${false},
        ${false},
        ${false},
        ${false},
        ${false},
        ${new Date()}
      )
      RETURNING id, "orderNumber", status::text AS status
    `;

    const created = rows[0];
    if (!created) {
      console.error('[erpCreateOrder] INSERT returned no rows');
      return { error: 'INSERT_FAILED' };
    }
    console.log('[erpCreateOrder] Order created', {
      id: created.id,
      orderNumber: created.orderNumber,
    });
    return {
      id: String(created.id),
      orderNumber: created.orderNumber,
      status: created.status,
    };
  } catch (e) {
    const err = e as Error & { code?: string; meta?: unknown };
    console.error('[erpCreateOrder] Failed', {
      message: err.message,
      code: err.code,
      meta: err.meta,
      stack: err.stack,
    });
    return { error: err.message };
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
