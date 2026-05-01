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

function headers(cfg: ErpConfigShape) {
  return {
    'Content-Type': 'application/json',
    'X-API-Key': cfg.apiKey,
  };
}

export async function erpTestConnection(cfg: ErpConfigShape): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${cfg.apiUrl}/api/products?search=test&pageSize=1`, {
      headers: headers(cfg),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function erpSearchProducts(cfg: ErpConfigShape, query: string, pageSize = 5): Promise<ErpProduct[]> {
  try {
    const res = await fetch(`${cfg.apiUrl}/api/products?search=${encodeURIComponent(query)}&pageSize=${pageSize}`, {
      headers: headers(cfg),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}

export async function erpGetProduct(cfg: ErpConfigShape, id: string): Promise<ErpProduct | null> {
  try {
    const res = await fetch(`${cfg.apiUrl}/api/products/${encodeURIComponent(id)}`, {
      headers: headers(cfg),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.json();
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
}

export async function erpCreateOrder(cfg: ErpConfigShape, input: ErpOrderInput): Promise<{ id?: string; orderNumber?: string; status?: string; error?: string }> {
  try {
    const body = { ...input, opp: 'chatbot', operatorNote: input.operatorNote || 'Facebook chatbot захиалга' };
    const res = await fetch(`${cfg.apiUrl}/api/orders`, {
      method: 'POST',
      headers: headers(cfg),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { error: `HTTP ${res.status}: ${text}` };
    }
    return await res.json();
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function erpSearchOrders(cfg: ErpConfigShape, phone: string): Promise<any[]> {
  try {
    const res = await fetch(`${cfg.apiUrl}/api/orders?search=${encodeURIComponent(phone)}`, {
      headers: headers(cfg),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}
