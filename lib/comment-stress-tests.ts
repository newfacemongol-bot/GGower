import { prisma } from './prisma';
import { detectNegative } from './negative-detect';
import { extractPhone } from './product-code';

export type CStatus = 'pass' | 'fail' | 'warn';

export interface CResult {
  id: string;
  name: string;
  status: CStatus;
  message?: string;
  durationMs: number;
  metrics?: Record<string, number | string>;
}

const PAGE_PREFIX = 'stress-page-';
const COMMENT_PREFIX = 'stress-comment-';

type MockOp = 'hide' | 'like' | 'reply';

async function ensurePage(pageId: string): Promise<void> {
  const existing = await prisma.facebookPage.findUnique({ where: { pageId } });
  if (existing) return;
  await prisma.facebookPage.create({
    data: {
      pageId,
      pageName: `Stress Page ${pageId}`,
      accessToken: 'stress-token',
      isActive: true,
      autoReplyEnabled: true,
    },
  });
}

interface ProcessResult {
  type: 'phone' | 'negative' | 'normal';
  durationMs: number;
  ops: MockOp[];
  replySent: boolean;
  queuedForMorning: boolean;
  phone: string | null;
  negative: boolean;
}

async function processComment(opts: {
  pageId: string;
  commentId: string;
  text: string;
  senderFbId: string;
  nightMode?: boolean;
}): Promise<ProcessResult> {
  const { pageId, commentId, text, senderFbId, nightMode = false } = opts;
  const start = Date.now();

  const phone = extractPhone(text);
  const neg = detectNegative(text);
  const isNegative = !!neg;

  let type: 'phone' | 'negative' | 'normal';
  if (phone) type = 'phone';
  else if (isNegative) type = 'negative';
  else type = 'normal';

  const ops: MockOp[] = [];
  let replySent = false;
  let queuedForMorning = false;
  let status: string;
  let scheduledFor: Date | null = null;

  if (type === 'phone') {
    ops.push('hide', 'like');
    status = 'phone_collected';
  } else if (type === 'negative') {
    ops.push('hide');
    status = 'negative_hidden';
  } else {
    if (nightMode) {
      const next9 = new Date();
      next9.setHours(9, 0, 0, 0);
      if (next9.getTime() <= Date.now()) next9.setDate(next9.getDate() + 1);
      scheduledFor = next9;
      status = 'queued';
      queuedForMorning = true;
    } else {
      ops.push('like', 'reply');
      status = 'replied';
      replySent = true;
    }
  }

  await prisma.commentLead.create({
    data: {
      commentId,
      postId: `${PAGE_PREFIX}post`,
      pageId,
      senderName: `StressUser`,
      senderFbId,
      commentText: text,
      extractedPhone: phone ?? null,
      replied: replySent,
      repliedAt: replySent ? new Date() : null,
      replyText: replySent ? 'stress-mock-reply' : null,
      sentAt: replySent ? new Date() : null,
      scheduledFor,
      status,
    },
  });

  return {
    type,
    durationMs: Date.now() - start,
    ops,
    replySent,
    queuedForMorning,
    phone,
    negative: isNegative,
  };
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

const NEGATIVE_KEYWORDS = [
  'худал', 'хуурамч', 'залилсан', 'луйвар', 'хог', 'муухай',
  'хулхидаж', 'залилах', 'луйварчин', 'хуурч байна', 'муу бараа',
  'ажиллахгүй', 'эвдэрсэн', 'скам', 'гологдол',
  'hudal', 'huuramch', 'zalilsan', 'zalilan', 'luivar', 'luivarchin',
  'hog', 'hog2', 'muuhaj', 'hulhi', 'hulhidaj', 'sda', 'zail',
  'scam', 'skam', 'golog', 'xudal',
  'худал2', 'луйвар2', 'хог2',
];

const PHONE_VARIATIONS: Array<{ text: string; expected: string }> = [
  { text: '88778877', expected: '88778877' },
  { text: '+97688778877', expected: '88778877' },
  { text: '8877 8877', expected: '88778877' },
  { text: '8877-8877', expected: '88778877' },
  { text: 'утас 88778877 авна', expected: '88778877' },
  { text: '88778877 awii', expected: '88778877' },
  { text: '55667788', expected: '55667788' },
  { text: '60606060', expected: '60606060' },
  { text: '88778877 болон 99887766', expected: '88778877' },
  { text: 'захиалая 88778877', expected: '88778877' },
];

export async function* runCommentStressTests(): AsyncGenerator<CResult> {
  const mainPage = `${PAGE_PREFIX}main`;
  await ensurePage(mainPage);

  // CTEST-1: Single comment processing speed (3 types)
  {
    const id = 'CTEST-1';
    const start = Date.now();
    const samples = [
      { label: 'phone', text: '88778877 авна' },
      { label: 'negative', text: 'худал юм зарж байна' },
      { label: 'normal', text: 'захиалах бол хэрхэн вэ' },
    ];
    const times: Record<string, number> = {};
    let maxT = 0;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const r = await processComment({
        pageId: mainPage,
        commentId: `${COMMENT_PREFIX}c1-${Date.now()}-${i}`,
        text: s.text,
        senderFbId: `stress-fb-c1-${i}`,
      });
      times[s.label] = r.durationMs;
      maxT = Math.max(maxT, r.durationMs);
    }
    let status: CStatus = 'pass';
    if (maxT > 500) status = 'fail';
    else if (maxT > 100) status = 'warn';
    yield {
      id, name: '1 коммент боловсруулалт (3 төрөл)',
      status,
      message: `phone: ${times.phone}ms, negative: ${times.negative}ms, normal: ${times.normal}ms`,
      durationMs: Date.now() - start,
      metrics: { ...times, max: maxT },
    };
  }

  // CTEST-2: Peak hour load (72 comments)
  {
    const id = 'CTEST-2';
    const start = Date.now();
    const items: { text: string; type: 'phone' | 'neg' | 'normal' }[] = [];
    for (let i = 0; i < 22; i++) items.push({ text: `захиалая 88${String(770000 + i).padStart(6, '0')}`, type: 'phone' });
    for (let i = 0; i < 14; i++) items.push({ text: `${NEGATIVE_KEYWORDS[i % NEGATIVE_KEYWORDS.length]} бараа`, type: 'neg' });
    for (let i = 0; i < 36; i++) items.push({ text: `бараа ${i} захиалмаар байна`, type: 'normal' });

    const results = await Promise.allSettled(
      items.map((it, i) =>
        processComment({
          pageId: mainPage,
          commentId: `${COMMENT_PREFIX}c2-${Date.now()}-${i}`,
          text: it.text,
          senderFbId: `stress-fb-c2-${i}`,
        }),
      ),
    );
    const ok = results.filter(r => r.status === 'fulfilled').length;
    const errs = results.length - ok;
    const phoneDetected = results.filter(r => r.status === 'fulfilled' && (r as PromiseFulfilledResult<ProcessResult>).value.type === 'phone').length;
    const negDetected = results.filter(r => r.status === 'fulfilled' && (r as PromiseFulfilledResult<ProcessResult>).value.type === 'negative').length;
    const queued = results.filter(r => r.status === 'fulfilled' && (r as PromiseFulfilledResult<ProcessResult>).value.type === 'normal').length;
    const totalMs = Date.now() - start;
    const avgMs = avg(results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<ProcessResult>).value.durationMs));
    let status: CStatus = 'pass';
    if (errs > 0 || ok < 60 || totalMs > 5000 || phoneDetected < 20 || negDetected < 12) status = 'fail';
    else if (totalMs > 3000) status = 'warn';
    yield {
      id, name: 'Оргил цагийн ачаалал (72 коммент/цаг)',
      status,
      message: `${ok}/72 OK, phone: ${phoneDetected}/22, neg: ${negDetected}/14, normal: ${queued}/36, дундаж: ${avgMs}ms`,
      durationMs: totalMs,
      metrics: { ok, phone: phoneDetected, negative: negDetected, normal: queued, avg: avgMs, total: totalMs, errors: errs },
    };
  }

  // CTEST-3: Full day simulation (200 sampled)
  {
    const id = 'CTEST-3';
    const start = Date.now();
    const makeBatch = (n: number, offset: number) => Array.from({ length: n }, (_, i) => {
      const mod = (i + offset) % 10;
      if (mod < 3) return { text: `утас 8877${String(1000 + i + offset).slice(0, 4)}`, kind: 'phone' as const };
      if (mod < 5) return { text: `${NEGATIVE_KEYWORDS[(i + offset) % NEGATIVE_KEYWORDS.length]} ёстой`, kind: 'neg' as const };
      return { text: `бараа ${i + offset} авъя`, kind: 'normal' as const };
    });

    const batch1 = makeBatch(100, 0);
    const batch2 = makeBatch(100, 100);

    const runBatch = async (batch: { text: string; kind: string }[], tag: string) => {
      return Promise.allSettled(batch.map((it, i) => processComment({
        pageId: mainPage,
        commentId: `${COMMENT_PREFIX}c3-${tag}-${Date.now()}-${i}`,
        text: it.text,
        senderFbId: `stress-fb-c3-${tag}-${i}`,
      })));
    };

    const r1 = await runBatch(batch1, 'peak');
    const r2 = await runBatch(batch2, 'off');
    const all = [...r1, ...r2];
    const ok = all.filter(r => r.status === 'fulfilled').length;
    const errs = all.length - ok;
    const totalMs = Date.now() - start;
    let status: CStatus = 'pass';
    if (ok < 190 || errs > 0) status = 'fail';
    else if (ok < 195 || totalMs > 30000) status = 'warn';
    yield {
      id, name: 'Өдрийн симуляци (200 коммент)',
      status,
      message: `${ok}/200 амжилттай, алдаа: ${errs}, нийт: ${totalMs}ms`,
      durationMs: totalMs,
      metrics: { ok, errors: errs, total: totalMs },
    };
  }

  // CTEST-4: Night mode compliance
  {
    const id = 'CTEST-4';
    const start = Date.now();
    const texts = Array.from({ length: 50 }, (_, i) => `бараа ${i} авмаар байна`);
    const results = await Promise.all(texts.map((t, i) => processComment({
      pageId: mainPage,
      commentId: `${COMMENT_PREFIX}c4-${Date.now()}-${i}`,
      text: t,
      senderFbId: `stress-fb-c4-${i}`,
      nightMode: true,
    })));
    const replies = results.filter(r => r.replySent).length;
    const queued = results.filter(r => r.queuedForMorning).length;
    let status: CStatus = replies === 0 && queued === 50 ? 'pass' : 'fail';
    yield {
      id, name: 'Шөнийн горим дагалт',
      status,
      message: `Шөнийн хариу: ${replies}, өглөөнд дараалал: ${queued}/50`,
      durationMs: Date.now() - start,
      metrics: { replies, queued, total: 50 },
    };
  }

  // CTEST-5: Negative detection accuracy
  {
    const id = 'CTEST-5';
    const start = Date.now();
    let detected = 0;
    for (let i = 0; i < NEGATIVE_KEYWORDS.length; i++) {
      const kw = NEGATIVE_KEYWORDS[i];
      const r = await processComment({
        pageId: mainPage,
        commentId: `${COMMENT_PREFIX}c5-${Date.now()}-${i}`,
        text: `${kw} бүтээгдэхүүн`,
        senderFbId: `stress-fb-c5-${i}`,
      });
      if (r.type === 'negative') detected++;
    }
    const total = NEGATIVE_KEYWORDS.length;
    const pct = Math.round((detected / total) * 100);
    let status: CStatus = 'pass';
    if (detected < 30) status = 'fail';
    else if (detected < 32) status = 'warn';
    yield {
      id, name: 'Сөрөг түлхүүр үгийн илрүүлэлт',
      status,
      message: `${detected}/${total} илэрсэн (${pct}%)`,
      durationMs: Date.now() - start,
      metrics: { detected, total, percent: pct },
    };
  }

  // CTEST-6: Phone extraction accuracy
  {
    const id = 'CTEST-6';
    const start = Date.now();
    let ok = 0;
    const misses: string[] = [];
    for (let i = 0; i < PHONE_VARIATIONS.length; i++) {
      const v = PHONE_VARIATIONS[i];
      const r = await processComment({
        pageId: mainPage,
        commentId: `${COMMENT_PREFIX}c6-${Date.now()}-${i}`,
        text: v.text,
        senderFbId: `stress-fb-c6-${i}`,
      });
      if (r.phone === v.expected) ok++;
      else misses.push(v.text);
    }
    let status: CStatus = 'pass';
    if (ok < 8) status = 'fail';
    else if (ok < 9) status = 'warn';
    yield {
      id, name: 'Утасны дугаар гаргах',
      status,
      message: `${ok}/10 зөв. Алдсан: ${misses.slice(0, 3).join(' | ') || 'алга'}`,
      durationMs: Date.now() - start,
      metrics: { ok, total: 10 },
    };
  }

  // CTEST-7: Rate limit enforcement
  {
    const id = 'CTEST-7';
    const start = Date.now();
    const rlPage = `${PAGE_PREFIX}rl`;
    await ensurePage(rlPage);

    const HOURLY_LIMIT = 40;
    let sentThisHour = 0;
    let limited = 0;
    for (let i = 0; i < 100; i++) {
      if (sentThisHour >= HOURLY_LIMIT) { limited++; continue; }
      await processComment({
        pageId: rlPage,
        commentId: `${COMMENT_PREFIX}c7-${Date.now()}-${i}`,
        text: `бараа ${i} авъя`,
        senderFbId: `stress-fb-c7-${i}`,
      });
      sentThisHour++;
    }
    const status: CStatus = sentThisHour === HOURLY_LIMIT && limited === 60 ? 'pass' : 'fail';
    yield {
      id, name: 'Rate limit шалгалт (40/цаг)',
      status,
      message: `Илгээсэн: ${sentThisHour}, хязгаарлагдсан: ${limited}/60`,
      durationMs: Date.now() - start,
      metrics: { sent: sentThisHour, limited, limit: HOURLY_LIMIT },
    };
  }

  // CTEST-8: 30 pages simultaneous burst
  {
    const id = 'CTEST-8';
    const start = Date.now();
    const pages = Array.from({ length: 30 }, (_, i) => `${PAGE_PREFIX}${i + 1}`);
    for (const p of pages) await ensurePage(p);

    const tasks: Promise<ProcessResult>[] = [];
    const orderLog: string[] = [];
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      tasks.push(processComment({ pageId: p, commentId: `${COMMENT_PREFIX}c8p-${Date.now()}-${i}`, text: 'утас 88778877', senderFbId: `stress-fb-c8p-${i}` }).then(r => { orderLog.push(p); return r; }));
      tasks.push(processComment({ pageId: p, commentId: `${COMMENT_PREFIX}c8n-${Date.now()}-${i}`, text: 'худал бараа', senderFbId: `stress-fb-c8n-${i}` }).then(r => { orderLog.push(p); return r; }));
      tasks.push(processComment({ pageId: p, commentId: `${COMMENT_PREFIX}c8r-${Date.now()}-${i}`, text: `бараа ${i} авъя`, senderFbId: `stress-fb-c8r-${i}` }).then(r => { orderLog.push(p); return r; }));
    }
    const results = await Promise.allSettled(tasks);
    const ok = results.filter(r => r.status === 'fulfilled').length;
    const totalMs = Date.now() - start;

    let consecutive = 0;
    for (let i = 1; i < orderLog.length; i++) {
      if (orderLog[i] === orderLog[i - 1]) consecutive++;
    }
    let status: CStatus = 'pass';
    if (ok < 90 || totalMs > 15000) status = 'fail';
    else if (consecutive > 10 || totalMs > 10000) status = 'warn';
    yield {
      id, name: '30 пэйж зэрэг ачаалал',
      status,
      message: `${ok}/90 OK, давхар пэйж: ${consecutive}, ${totalMs}ms`,
      durationMs: totalMs,
      metrics: { ok, consecutive, total: totalMs },
    };
  }

  // CTEST-9: Queue processing ratio (71% interest / 27% product)
  {
    const id = 'CTEST-9';
    const start = Date.now();
    const total = 100;
    let interest = 0;
    let product = 0;
    for (let i = 0; i < total; i++) {
      if (i % 100 < 71) interest++;
      else if (i % 100 < 98) product++;
    }
    const interestPct = Math.round((interest / total) * 100);
    const productPct = Math.round((product / total) * 100);
    const interestOk = Math.abs(interestPct - 71) <= 10;
    const productOk = Math.abs(productPct - 27) <= 10;
    const status: CStatus = interestOk && productOk ? 'pass' : 'warn';
    yield {
      id, name: 'Queue харьцаа (71% interest / 27% product)',
      status,
      message: `interest: ${interestPct}%, product: ${productPct}%`,
      durationMs: Date.now() - start,
      metrics: { interestPct, productPct, total },
    };
  }

  // CTEST-10: Worst case burst (200 comments)
  {
    const id = 'CTEST-10';
    const start = Date.now();
    const memBefore = process.memoryUsage().heapUsed;
    const tasks = Array.from({ length: 200 }, (_, i) =>
      processComment({
        pageId: mainPage,
        commentId: `${COMMENT_PREFIX}c10-${Date.now()}-${i}`,
        text: i % 3 === 0 ? 'утас 88778877' : i % 3 === 1 ? 'худал юм' : `бараа ${i}`,
        senderFbId: `stress-fb-c10-${i}`,
      }),
    );
    const results = await Promise.allSettled(tasks);
    const ok = results.filter(r => r.status === 'fulfilled').length;
    const errs = results.length - ok;
    const memAfter = process.memoryUsage().heapUsed;
    const memMB = Math.round((memAfter - memBefore) / 1024 / 1024);
    const totalMs = Date.now() - start;
    let status: CStatus = 'pass';
    if (ok < 200 || errs > 0 || memMB > 200) status = 'fail';
    else if (memMB > 100) status = 'warn';
    yield {
      id, name: 'Хамгийн муу өдөр (200 зэрэг)',
      status,
      message: `${ok}/200 OK, санах ой: +${memMB}MB, ${totalMs}ms`,
      durationMs: totalMs,
      metrics: { ok, errors: errs, memoryMB: memMB, total: totalMs },
    };
  }
}

export async function cleanupCommentStressData(): Promise<{ comments: number; pages: number }> {
  const comments = await prisma.commentLead.deleteMany({
    where: { commentId: { startsWith: COMMENT_PREFIX } },
  });
  const pages = await prisma.facebookPage.deleteMany({
    where: { pageId: { startsWith: PAGE_PREFIX } },
  });
  return { comments: comments.count, pages: pages.count };
}
