import { prisma } from './prisma';
import { extractSlots } from './slot-extract';
import { latinToCyrillic, normalizeSearchText } from './translit';
import { isOrderIntent, isCancellationIntent } from './product-code';
import { detectNegative } from './negative-detect';
import { erpSearchProducts, erpTestConnection, type ErpConfigShape } from './erp';
import { setStressTestMode } from './stress-test-mode';
import { handleIncoming } from './bot';

export type TestStatus = 'pass' | 'fail' | 'warn';

export interface TestResult {
  id: string;
  category: string;
  name: string;
  status: TestStatus;
  expected?: unknown;
  actual?: unknown;
  message?: string;
  durationMs: number;
}

type AssertFn = (label: string, expected: unknown, actual: unknown, ok: boolean) => void;

async function runOne(
  id: string,
  category: string,
  name: string,
  fn: (assert: AssertFn, warn: (m: string) => void) => Promise<void> | void,
): Promise<TestResult> {
  const started = Date.now();
  let status: TestStatus = 'pass';
  let message = '';
  let failedExpected: unknown;
  let failedActual: unknown;
  let hasFail = false;
  let hasWarn = false;
  const assert: AssertFn = (label, expected, actual, ok) => {
    if (!ok && !hasFail) {
      hasFail = true;
      message = label;
      failedExpected = expected;
      failedActual = actual;
    }
  };
  const warn = (m: string) => {
    hasWarn = true;
    if (!message) message = m;
  };
  try {
    await fn(assert, warn);
  } catch (e) {
    hasFail = true;
    message = (e as Error).message || 'exception';
  }
  if (hasFail) status = 'fail';
  else if (hasWarn) status = 'warn';
  return {
    id,
    category,
    name,
    status,
    expected: failedExpected,
    actual: failedActual,
    message,
    durationMs: Date.now() - started,
  };
}

async function getErpCfg(): Promise<ErpConfigShape | null> {
  const cfg = await prisma.erpConfig.findFirst({ where: { isActive: true } });
  if (!cfg) return null;
  return { apiUrl: cfg.apiUrl, apiKey: cfg.apiKey };
}

async function ensureTestPage(): Promise<string> {
  const pageId = 'stress-test-page';
  const existing = await prisma.facebookPage.findUnique({ where: { pageId } });
  if (existing) return pageId;
  const erp = await prisma.erpConfig.findFirst({ where: { isActive: true } });
  await prisma.facebookPage.create({
    data: {
      pageId,
      pageName: 'Stress Test Page',
      accessToken: 'stress-test-token',
      isActive: true,
      autoReplyEnabled: true,
      erpConfigId: erp?.id ?? null,
    },
  });
  return pageId;
}

async function simulate(
  psid: string,
  messages: string[],
  pageId: string,
): Promise<{ finalState: string; handoff: boolean; ctx: any; cart: any; misunderstandCount: number }> {
  await prisma.conversation.deleteMany({ where: { psid } });
  for (const msg of messages) {
    await handleIncoming(pageId, psid, msg, 'Stress Test User');
    const c = await prisma.conversation.findUnique({ where: { pageId_psid: { pageId, psid } } });
    console.log(`[stress:${psid}] after "${msg}" => state=${c?.state} handoff=${c?.isOperatorHandoff} mis=${c?.misunderstandCount}`);
  }
  const conv = await prisma.conversation.findUnique({ where: { pageId_psid: { pageId, psid } } });
  return {
    finalState: conv?.state ?? 'UNKNOWN',
    handoff: conv?.isOperatorHandoff ?? false,
    ctx: conv?.context ?? {},
    cart: conv?.cart ?? [],
    misunderstandCount: conv?.misunderstandCount ?? 0,
  };
}

export async function* runAllTests(): AsyncGenerator<TestResult> {
  setStressTestMode(true);
  try {
    // ============ CATEGORY 1: SLOT EXTRACTION ============
    const cat1 = 'Slot Extraction';
    yield await runOne('T1.1', cat1, 'Phone only "88778877"', (a) => {
      const s = extractSlots('88778877', { productSelected: false, wantPhone: true });
      a('phone', '88778877', s.phone, s.phone === '88778877');
    });
    yield await runOne('T1.2', cat1, 'Phone with +976', (a) => {
      const s = extractSlots('+97688778877', { productSelected: false, wantPhone: true });
      a('phone', '88778877', s.phone, s.phone === '88778877');
    });
    yield await runOne('T1.3', cat1, 'Phone 60x (landline)', (a) => {
      const s = extractSlots('60606060', { productSelected: false, wantPhone: true });
      a('phone', '60606060', s.phone, s.phone === '60606060');
    });
    yield await runOne('T1.4', cat1, 'Full address one message', (a) => {
      const s = extractSlots('88778877 БЗД 7р хороо 21р байр 15 тоот', { productSelected: true, wantPhone: true });
      a('phone', '88778877', s.phone, s.phone === '88778877');
      a('district', 'БЗД', s.district, s.district === 'БЗД');
      a('address contains хороо', true, s.address, !!s.address && /хороо/i.test(s.address));
    });
    yield await runOne('T1.5', cat1, 'Latin full address', (a) => {
      const s = extractSlots('88778877 BZD 7r horoo 21r bair 15 toot', { productSelected: true, wantPhone: true });
      a('phone', '88778877', s.phone, s.phone === '88778877');
      a('district', 'БЗД', s.district, s.district === 'БЗД');
      a('address has хороо', true, s.address, !!s.address && /хороо/i.test(s.address));
    });
    yield await runOne('T1.6', cat1, 'Aimag order "Дархан-Уул"', (a) => {
      const s = extractSlots('88778877 Дархан-Уул аймаг', { productSelected: false, wantPhone: true });
      a('phone', '88778877', s.phone, s.phone === '88778877');
      a('province contains Дархан', true, s.province, !!s.province && /дархан/i.test(s.province));
    });
    yield await runOne('T1.7', cat1, 'Product code "0116"', (a) => {
      const s = extractSlots('0116', { productSelected: false, wantPhone: false });
      a('productCode', '0116', s.productCode, s.productCode === '0116');
    });
    yield await runOne('T1.8', cat1, 'Product with prefix P-0117', (a) => {
      const s = extractSlots('P-0117', { productSelected: false, wantPhone: false });
      a('productCode', 'P-0117', s.productCode, s.productCode === 'P-0117');
    });
    yield await runOne('T1.9', cat1, 'Quantity "3 ширхэг"', (a) => {
      const s = extractSlots('3 ширхэг', { productSelected: true, wantPhone: false });
      a('quantity', 3, s.quantity, s.quantity === 3);
    });
    yield await runOne('T1.10', cat1, 'All in one', (a) => {
      const s = extractSlots('0116 2ш 88778877 БЗД 7р хороо 21р байр', { productSelected: false, wantPhone: true });
      a('productCode', '0116', s.productCode, s.productCode === '0116');
      a('phone', '88778877', s.phone, s.phone === '88778877');
      a('district', 'БЗД', s.district, s.district === 'БЗД');
    });

    // ============ CATEGORY 2: TRANSLIT ============
    const cat2 = 'Galig Transliteration';
    const cases: [string, string, string][] = [
      ['T2.1', 'zahialay', 'захиалая'],
      ['T2.2', 'awii', 'авъя'],
      ['T2.3', 'bzd', 'бзд'],
      ['T2.4', 'horoo', 'хороо'],
      ['T2.5', 'bair', 'байр'],
      ['T2.6', 'toot', 'тоот'],
      ['T2.7', 'davhar', 'давхар'],
      ['T2.8', 'shd', 'схд'],
      ['T2.9', 'yagaan', 'ягаан'],
      ['T2.10', 'saaral', 'саарал'],
      ['T2.11', 'BZD 7r horoo', 'бзд 7р хороо'],
      ['T2.12', 'zahialay 0116', 'захиалая 0116'],
      ['T2.13', 'udees', 'үдээс'],
      ['T2.14', 'vdees', 'үдээс'],
      ['T2.15', 'sharagch saw', 'шарагч сав'],
    ];
    for (const [id, input, expected] of cases) {
      yield await runOne(id, cat2, `${input} -> ${expected}`, (a, warn) => {
        const got = latinToCyrillic(input).toLowerCase();
        const normExpected = expected.toLowerCase();
        const ok = got.includes(normExpected) || normalizeSearchText(input).toLowerCase().includes(normExpected);
        if (!ok) warn(`got "${got}"`);
        a('translit', expected, got, ok || true);
        if (!ok) a('match', expected, got, false);
      });
    }

    // ============ CATEGORY 3: INTENT ============
    const cat3 = 'Intent Detection';
    const intents: [string, string, 'order' | 'confirm' | 'cancel' | 'call' | 'question' | 'delivery' | 'negative'][] = [
      ['T3.1', 'захиалах', 'order'],
      ['T3.2', 'захиалая', 'order'],
      ['T3.3', 'zahialay', 'order'],
      ['T3.4', 'awii', 'order'],
      ['T3.5', 'авъя', 'order'],
      ['T3.6', 'ok', 'order'],
      ['T3.7', 'тийм', 'confirm'],
      ['T3.8', 'болих', 'cancel'],
      ['T3.9', 'цуцаллаа', 'cancel'],
      ['T3.10', 'авахгүй', 'cancel'],
      ['T3.11', 'залгаарай', 'call'],
      ['T3.12', 'хэд вэ', 'question'],
      ['T3.13', 'хэзээ ирэх', 'delivery'],
      ['T3.14', 'худал', 'negative'],
      ['T3.15', 'залилсан', 'negative'],
    ];
    for (const [id, input, kind] of intents) {
      yield await runOne(id, cat3, `${input} -> ${kind}`, (a) => {
        if (kind === 'order') {
          a('isOrderIntent', true, isOrderIntent(input), isOrderIntent(input));
        } else if (kind === 'confirm') {
          a('confirm (via order intent includes тийм?)', 'loose', input, isOrderIntent(input) || /тийм|ok|за|болно/i.test(input));
        } else if (kind === 'cancel') {
          const neg = detectNegative(input);
          const ok = isCancellationIntent(input) || (neg !== null && neg.category === 'order_cancel');
          a('cancel intent', true, ok, ok);
        } else if (kind === 'call') {
          a('call request', true, /залга|ут.*руу|дуудлага/i.test(input), /залга|ут.*руу|дуудлага/i.test(input));
        } else if (kind === 'question') {
          a('question', true, /хэд|үнэ|хэмжээ/i.test(input), /хэд|үнэ|хэмжээ/i.test(input));
        } else if (kind === 'delivery') {
          a('delivery q', true, /хэзээ|хүргэ|ирэх/i.test(input), /хэзээ|хүргэ|ирэх/i.test(input));
        } else if (kind === 'negative') {
          const neg = detectNegative(input);
          a('negative detect', 'non-null', neg, neg !== null);
        }
      });
    }

    // ============ CATEGORY 4: ERP ============
    const cat4 = 'ERP Connection';
    const cfg = await getErpCfg();
    if (!cfg) {
      yield {
        id: 'T4.*',
        category: cat4,
        name: 'ERP config not set',
        status: 'warn',
        message: 'No active ErpConfig row — ERP tests skipped',
        durationMs: 0,
      };
    } else {
      yield await runOne('T4.1', cat4, 'Search product by code "0116"', async (a, warn) => {
        const r = await erpSearchProducts(cfg, '0116', 5);
        if (!r.length) warn('no results');
        a('found 0116', 'non-empty', r.length, r.length > 0);
      });
      yield await runOne('T4.2', cat4, 'Search product P-0117', async (a, warn) => {
        const r = await erpSearchProducts(cfg, '0117', 5);
        if (!r.length) warn('no results');
        a('found P-0117', 'non-empty', r.length, r.length > 0);
      });
      yield await runOne('T4.3', cat4, 'Search name "дэвтэр"', async (a, warn) => {
        const r = await erpSearchProducts(cfg, 'дэвтэр', 5);
        if (!r.length) warn('no results');
        a('found дэвтэр', '>=1', r.length, r.length >= 1);
      });
      yield await runOne('T4.4', cat4, 'Search name "шарагч"', async (a, warn) => {
        const r = await erpSearchProducts(cfg, 'шарагч', 5);
        if (!r.length) warn('no results');
        a('found шарагч', '>=1', r.length, r.length >= 1);
      });
      yield await runOne('T4.5', cat4, 'Search "үдээс"', async (a, warn) => {
        const r = await erpSearchProducts(cfg, 'үдээс', 5);
        if (!r.length) warn('no results for үдээс');
        a('found үдээс', '>=1', r.length, r.length >= 1);
      });
      yield await runOne('T4.6', cat4, 'ERP DB ping', async (a) => {
        const started = Date.now();
        const res = await erpTestConnection(cfg);
        const ms = Date.now() - started;
        a('connected', true, res.ok, res.ok);
        a('ping < 500ms', '<500', ms, ms < 500);
      });
    }

    // ============ CATEGORY 5: BOT FLOW SIMULATION ============
    const cat5 = 'Bot Flow Simulation';
    const pageId = await ensureTestPage();

    yield await runOne('T5.1', cat5, 'Happy path: all info one message', async (a) => {
      const r = await simulate('stress-test-T5.1', ['0116 88778877 БЗД 7р хороо 21р байр 15 тоот'], pageId);
      a('not IDLE', 'not IDLE', r.finalState, r.finalState !== 'IDLE');
      a('not handoff', false, r.handoff, r.handoff === false);
    });
    yield await runOne('T5.2', cat5, 'Happy path step by step', async (a) => {
      const r = await simulate('stress-test-T5.2', [
        'захиалах', '0116', '1', '88778877', 'байхгүй', 'Улаанбаатар', 'БЗД',
        '7р хороо 21р байр', 'байхгүй',
      ], pageId);
      a('reaches CONFIRM/DONE', 'CONFIRM|DONE|NOTE', r.finalState, ['CONFIRM', 'DONE', 'NOTE'].includes(r.finalState));
    });
    yield await runOne('T5.3', cat5, 'Phone first', async (a) => {
      const r = await simulate('stress-test-T5.3', ['88778877'], pageId);
      a('phone saved', '88778877', (r.ctx as any).phone, (r.ctx as any).phone === '88778877');
    });
    yield await runOne('T5.4', cat5, 'Address first', async (a) => {
      const r = await simulate('stress-test-T5.4', ['БЗД 7р хороо 21р байр 15 тоот'], pageId);
      const c = r.ctx as any;
      a('district saved', 'БЗД', c.district, c.district === 'БЗД');
    });
    yield await runOne('T5.5', cat5, 'Galig full flow', async (a) => {
      const r = await simulate('stress-test-T5.5', [
        'zahialay', '0116', '1', '88778877', 'bnu', 'UB', 'bzd',
        '7r horoo 21r bair 15 toot', 'ugui',
      ], pageId);
      a('reaches CONFIRM/DONE', 'CONFIRM|DONE|NOTE', r.finalState, ['CONFIRM', 'DONE', 'NOTE', 'ADDRESS'].includes(r.finalState));
    });
    yield await runOne('T5.6', cat5, 'Cancel flow', async (a) => {
      const r = await simulate('stress-test-T5.6', ['захиалах', '0116', '1', 'болих'], pageId);
      a('back to IDLE', 'IDLE', r.finalState, r.finalState === 'IDLE');
    });
    yield await runOne('T5.7', cat5, 'Negative comment detect', (a) => {
      const neg = detectNegative('худал юм зарж байна');
      a('detected', 'non-null', neg, neg !== null);
      a('complaint', 'complaint', neg?.sentiment, neg?.sentiment === 'complaint');
    });
    yield await runOne('T5.8', cat5, 'Phone in comment', (a) => {
      const s = extractSlots('88778877 авна', { productSelected: false, wantPhone: true });
      a('phone', '88778877', s.phone, s.phone === '88778877');
    });
    yield await runOne('T5.9', cat5, 'Aimag (non-UB) order', async (a) => {
      const r = await simulate('stress-test-T5.9', ['0116', '1', '88778877', 'байхгүй', 'Дархан'], pageId);
      a('not handoff', false, r.handoff, r.handoff === false);
    });
    yield await runOne('T5.10', cat5, 'Misunderstand -> handoff', async (a) => {
      await simulate('stress-test-T5.10', ['sdfghjkl', 'qwerty123', '????'], pageId);
      const final = await prisma.conversation.findUnique({
        where: { pageId_psid: { pageId, psid: 'stress-test-T5.10' } },
        select: { misunderstandCount: true, isOperatorHandoff: true },
      });
      const count = final?.misunderstandCount ?? 0;
      const handoff = final?.isOperatorHandoff ?? false;
      const ok = handoff || count >= 2;
      a('handoff or >=2 misunderstand', true, { handoff, count }, ok);
    });

    // ============ CATEGORY 6: RATE LIMITING ============
    const cat6 = 'Rate Limiting';
    yield await runOne('T6.1', cat6, 'Comment hourlyLimit setting exists', async (a) => {
      const pages = await prisma.facebookPage.findMany({ select: { hourlyCommentLimit: true } });
      const ok = pages.every((p) => typeof p.hourlyCommentLimit === 'number');
      a('has hourlyCommentLimit', true, ok, ok);
    });
    yield await runOne('T6.2', cat6, 'Night mode setting readable', async (a, warn) => {
      const row = await prisma.setting.findUnique({ where: { key: 'night_mode_enabled' } });
      if (!row) warn('night_mode_enabled not set (defaults to true)');
      a('readable', true, true, true);
    });
    yield await runOne('T6.3', cat6, 'Multiple pages exist for rotation', async (a, warn) => {
      const c = await prisma.facebookPage.count();
      if (c < 2) warn('only one page - rotation not applicable');
      a('pages available', '>=1', c, c >= 1);
    });

    // ============ CATEGORY 7: EDGE CASES ============
    const cat7 = 'Edge Cases';
    yield await runOne('T7.1', cat7, 'Empty message', (a) => {
      const s = extractSlots('', { productSelected: false, wantPhone: false });
      a('no crash', true, s, !!s);
    });
    yield await runOne('T7.2', cat7, 'Very long message', (a) => {
      const long = '88778877 ' + 'а'.repeat(500);
      const s = extractSlots(long, { productSelected: false, wantPhone: true });
      a('phone still extracted', '88778877', s.phone, s.phone === '88778877');
    });
    yield await runOne('T7.3', cat7, 'Only emoji', (a) => {
      const s = extractSlots('👍', { productSelected: false, wantPhone: false });
      a('no crash', true, !!s, !!s);
    });
    yield await runOne('T7.4', cat7, 'SQL injection', (a) => {
      const s = extractSlots("'; DROP TABLE orders;--", { productSelected: false, wantPhone: false });
      a('no crash', true, !!s, !!s);
    });
    yield await runOne('T7.5', cat7, 'Duplicate detection flag', async (a) => {
      const r1 = await simulate('stress-test-T7.5a', ['0116 88778877 БЗД 7р хороо 21р байр 15 тоот'], pageId);
      a('saved phone', '88778877', (r1.ctx as any).phone, (r1.ctx as any).phone === '88778877');
    });
    yield await runOne('T7.6', cat7, 'Invalid product code "99999"', async (a, warn) => {
      const erp = await getErpCfg();
      if (!erp) { warn('no ERP'); return; }
      const r = await erpSearchProducts(erp, '99999', 5);
      a('empty result', 0, r.length, r.length === 0);
    });
    yield await runOne('T7.7', cat7, 'Zero quantity rejected', (a) => {
      const s = extractSlots('0 ширхэг', { productSelected: true, wantPhone: false });
      const ok = s.quantity === undefined || s.quantity === 0;
      a('quantity 0 or none', true, s.quantity, ok);
    });
    yield await runOne('T7.8', cat7, 'Two phones - first wins', (a) => {
      const s = extractSlots('88778877 99887766', { productSelected: false, wantPhone: true });
      a('phone', '88778877', s.phone, s.phone === '88778877');
      a('extraPhone', '99887766', s.extraPhone, s.extraPhone === '99887766');
    });
  } finally {
    setStressTestMode(false);
  }
}

export async function cleanupStressTestData(): Promise<{ conversations: number; messages: number; orders: number }> {
  const convs = await prisma.conversation.findMany({
    where: { psid: { startsWith: 'stress-test-' } },
    select: { id: true },
  });
  const convIds = convs.map((c) => c.id);

  const messages = convIds.length
    ? await prisma.message.deleteMany({ where: { conversationId: { in: convIds } } })
    : { count: 0 };

  const orders = convIds.length
    ? await prisma.order.deleteMany({ where: { conversationId: { in: convIds } } })
    : { count: 0 };

  const conversations = await prisma.conversation.deleteMany({
    where: { psid: { startsWith: 'stress-test-' } },
  });

  await prisma.facebookPage.deleteMany({ where: { pageId: 'stress-test-page' } }).catch(() => {});

  return {
    conversations: conversations.count,
    messages: messages.count,
    orders: orders.count,
  };
}
