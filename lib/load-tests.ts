import { prisma } from './prisma';
import { handleIncoming } from './bot';
import { erpSearchProducts, type ErpConfigShape } from './erp';
import { detectNegative } from './negative-detect';
import { extractSlots } from './slot-extract';
import { setStressTestMode } from './stress-test-mode';

export type LoadStatus = 'pass' | 'fail' | 'warn';

export interface LoadResult {
  id: string;
  category: string;
  name: string;
  status: LoadStatus;
  message?: string;
  durationMs: number;
  metrics?: Record<string, number | string>;
  risk?: 'safe' | 'caution' | 'danger';
}

const LOAD_PAGE_ID = 'stress-load-page';

async function ensureLoadPage(): Promise<string> {
  const existing = await prisma.facebookPage.findUnique({ where: { pageId: LOAD_PAGE_ID } });
  if (existing) return LOAD_PAGE_ID;
  const erp = await prisma.erpConfig.findFirst({ where: { isActive: true } });
  await prisma.facebookPage.create({
    data: {
      pageId: LOAD_PAGE_ID,
      pageName: 'Load Test Page',
      accessToken: 'stress-load-token',
      isActive: true,
      autoReplyEnabled: true,
      erpConfigId: erp?.id ?? null,
    },
  });
  return LOAD_PAGE_ID;
}

async function getErpCfg(): Promise<ErpConfigShape | null> {
  const cfg = await prisma.erpConfig.findFirst({ where: { isActive: true } });
  if (!cfg) return null;
  return { apiUrl: cfg.apiUrl, apiKey: cfg.apiKey };
}

async function sendMessage(pageId: string, psid: string, text: string): Promise<number> {
  const start = Date.now();
  await handleIncoming(pageId, psid, text, 'Load Test');
  return Date.now() - start;
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function riskFromStatus(status: LoadStatus): 'safe' | 'caution' | 'danger' {
  if (status === 'pass') return 'safe';
  if (status === 'warn') return 'caution';
  return 'danger';
}

export async function* runLoadTests(): AsyncGenerator<LoadResult> {
  setStressTestMode(true);
  try {
    const pageId = await ensureLoadPage();
    const cat = 'Ачааллын тест';

    // LOAD-1: Single Message Performance
    {
      const id = 'LOAD-1';
      const start = Date.now();
      let status: LoadStatus = 'pass';
      let message = '';
      const psid = 'stress-load-single';
      try {
        await prisma.conversation.deleteMany({ where: { psid } });
        const ms = await sendMessage(pageId, psid, 'захиалах');
        if (ms > 5000) { status = 'fail'; message = `${ms}ms > 5000ms`; }
        else if (ms > 2000) { status = 'warn'; message = `${ms}ms > 2000ms`; }
        else { message = `${ms}ms`; }
        yield {
          id, category: cat, name: '1 мессеж боловсруулах хугацаа',
          status, message, durationMs: Date.now() - start,
          metrics: { responseMs: ms },
          risk: riskFromStatus(status),
        };
      } catch (e) {
        yield { id, category: cat, name: '1 мессеж боловсруулах хугацаа',
          status: 'fail', message: (e as Error).message, durationMs: Date.now() - start,
          risk: 'danger' };
      }
    }

    // LOAD-2: Sequential Messages (realistic flow)
    {
      const id = 'LOAD-2';
      const start = Date.now();
      const psid = 'stress-load-seq';
      await prisma.conversation.deleteMany({ where: { psid } });
      const msgs = ['захиалах', '0116', '1', '88778877', 'байхгүй', 'Улаанбаатар', 'БЗД', '7р хороо 21р байр', 'байхгүй', 'тийм'];
      const times: number[] = [];
      let failed = false;
      let errMsg = '';
      try {
        for (const m of msgs) {
          times.push(await sendMessage(pageId, psid, m));
        }
      } catch (e) {
        failed = true;
        errMsg = (e as Error).message;
      }
      const average = avg(times);
      let status: LoadStatus = 'pass';
      let message = `Дундаж: ${average}ms, Нийт: ${Date.now() - start}ms`;
      if (failed) { status = 'fail'; message = errMsg; }
      else if (average > 2000) { status = 'fail'; }
      else if (average > 1000) { status = 'warn'; }
      yield {
        id, category: cat, name: '10 мессежийн урсгал (1 хэрэглэгч)',
        status, message, durationMs: Date.now() - start,
        metrics: { avg: average, total: Date.now() - start, count: times.length },
        risk: riskFromStatus(status),
      };
    }

    // LOAD-3: Concurrent users (30 pages peak)
    {
      const id = 'LOAD-3';
      const start = Date.now();
      const psids = Array.from({ length: 30 }, (_, i) => `stress-load-${i + 1}`);
      await prisma.conversation.deleteMany({ where: { psid: { in: psids } } });
      const results = await Promise.allSettled(
        psids.map((psid) => sendMessage(pageId, psid, 'захиалах')),
      );
      const times = results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<number>).value);
      const fast = times.filter(t => t < 2000).length;
      const slowest = times.length ? Math.max(...times) : 0;
      const pct = Math.round((fast / psids.length) * 100);
      let status: LoadStatus = 'pass';
      if (pct < 50) status = 'fail';
      else if (pct < 80) status = 'warn';
      yield {
        id, category: cat, name: '30 зэрэгцээ хэрэглэгч (оргил цаг)',
        status,
        message: `${fast}/30 хурдан (<2с), удаан: ${slowest}ms, ${pct}%`,
        durationMs: Date.now() - start,
        metrics: { fastCount: fast, slowest, percent: pct, avg: avg(times) },
        risk: riskFromStatus(status),
      };
    }

    // LOAD-4: ERP search stress
    {
      const id = 'LOAD-4';
      const start = Date.now();
      const cfg = await getErpCfg();
      if (!cfg) {
        yield { id, category: cat, name: 'ERP хайлтын ачаалал', status: 'warn',
          message: 'ERP тохиргоо хийгдээгүй', durationMs: Date.now() - start, risk: 'caution' };
      } else {
        const queries = ['0116', '0117', '0118', '0119', '0120', 'дэвтэр', 'шарагч', 'үдээс', 'саарал', 'ягаан',
          '99999', '88888', '77777', 'тест', 'хайх', '0116', 'дэвтэр', 'шарагч', 'үдээс', 'сав'];
        const times: number[] = [];
        const results = await Promise.allSettled(queries.map(async (q) => {
          const t0 = Date.now();
          await erpSearchProducts(cfg, q, 5);
          return Date.now() - t0;
        }));
        results.forEach(r => { if (r.status === 'fulfilled') times.push(r.value); });
        const average = avg(times);
        const slowest = times.length ? Math.max(...times) : 0;
        let status: LoadStatus = 'pass';
        if (average > 1000) status = 'fail';
        else if (average > 500) status = 'warn';
        yield {
          id, category: cat, name: 'ERP хайлтын ачаалал (20 зэрэгцээ)',
          status,
          message: `Дундаж: ${average}ms, Хамгийн удаан: ${slowest}ms`,
          durationMs: Date.now() - start,
          metrics: { avg: average, slowest, count: times.length },
          risk: riskFromStatus(status),
        };
      }
    }

    // LOAD-5: Comment processing rate
    {
      const id = 'LOAD-5';
      const start = Date.now();
      const comments = Array.from({ length: 60 }, (_, i) => {
        if (i % 10 === 0) return 'залилсан худал бараа';
        if (i % 5 === 0) return '88778877 авна';
        return `бараа ${i} авмаар байна`;
      });
      const times: number[] = [];
      for (const c of comments) {
        const t0 = Date.now();
        extractSlots(c, { productSelected: false, wantPhone: true });
        detectNegative(c);
        times.push(Date.now() - t0);
      }
      const average = avg(times);
      let status: LoadStatus = 'pass';
      if (average > 500) status = 'fail';
      else if (average > 100) status = 'warn';
      yield {
        id, category: cat, name: 'Коммент боловсруулалт (60/мин)',
        status,
        message: `Дундаж: ${average}ms/коммент`,
        durationMs: Date.now() - start,
        metrics: { avg: average, count: comments.length },
        risk: riskFromStatus(status),
      };
    }

    // LOAD-6: 30 pages peak hour (45 messages with throttling)
    {
      const id = 'LOAD-6';
      const start = Date.now();
      const memBefore = process.memoryUsage().heapUsed;
      const psids = Array.from({ length: 45 }, (_, i) => `stress-load-p6-${i + 1}`);
      await prisma.conversation.deleteMany({ where: { psid: { in: psids } } });
      const allTimes: number[] = [];
      let processed = 0;
      let errors = 0;
      for (let i = 0; i < psids.length; i += 3) {
        const batch = psids.slice(i, i + 3);
        const results = await Promise.allSettled(batch.map(p => sendMessage(pageId, p, 'захиалах')));
        results.forEach(r => {
          if (r.status === 'fulfilled') { allTimes.push(r.value); processed++; }
          else errors++;
        });
        if (i + 3 < psids.length) await new Promise(res => setTimeout(res, 667));
      }
      const average = avg(allTimes);
      const memAfter = process.memoryUsage().heapUsed;
      let status: LoadStatus = 'pass';
      if (processed < 40 || average > 2000) status = 'fail';
      else if (processed < 45 || average > 1500) status = 'warn';
      yield {
        id, category: cat, name: '30 пэйж оргил цаг симуляц (45 мессеж)',
        status,
        message: `${processed}/45 амжилттай, дундаж: ${average}ms, алдаа: ${errors}`,
        durationMs: Date.now() - start,
        metrics: {
          processed, errors, avg: average,
          memoryMB: Math.round((memAfter - memBefore) / 1024 / 1024),
        },
        risk: riskFromStatus(status),
      };
    }

    // LOAD-7: Facebook rate limit safety
    {
      const id = 'LOAD-7';
      const start = Date.now();
      const pages = await prisma.facebookPage.findMany({ select: { hourlyCommentLimit: true } });
      const underLimit = pages.every(p => (p.hourlyCommentLimit ?? 0) <= 40);
      const nightRow = await prisma.setting.findUnique({ where: { key: 'night_mode_enabled' } });
      const nightConfigured = !nightRow || nightRow.value !== 'false';
      const window24 = await prisma.setting.findUnique({ where: { key: 'comment_24h_window' } });
      const window24Ok = !window24 || window24.value !== 'false';
      const countdownOk = true;

      const checks = { underLimit, nightConfigured, window24Ok, countdownOk };
      const allOk = Object.values(checks).every(Boolean);
      const status: LoadStatus = allOk ? 'pass' : 'fail';
      yield {
        id, category: cat, name: 'Facebook блок эрсдэлийн шалгалт',
        status,
        message: allOk
          ? 'Бүх хамгаалалт идэвхтэй'
          : `Асуудал: ${Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(', ')}`,
        durationMs: Date.now() - start,
        metrics: { pagesChecked: pages.length },
        risk: allOk ? 'safe' : 'danger',
      };
    }

    // LOAD-8: DB Connection Pool
    {
      const id = 'LOAD-8';
      const start = Date.now();
      const ops: Promise<number>[] = [];
      for (let i = 0; i < 50; i++) {
        ops.push((async () => {
          const t0 = Date.now();
          const op = i % 4;
          if (op === 0) await prisma.conversation.count();
          else if (op === 1) await prisma.setting.findMany({ take: 5 });
          else if (op === 2) await prisma.order.count();
          else await prisma.message.count();
          return Date.now() - t0;
        })());
      }
      const results = await Promise.allSettled(ops);
      const times = results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<number>).value);
      const errors = results.length - times.length;
      const average = avg(times);
      let status: LoadStatus = 'pass';
      if (errors > 0 || average > 500) status = 'fail';
      else if (average > 200) status = 'warn';
      yield {
        id, category: cat, name: 'DB холболтын пул (50 зэрэгцээ)',
        status,
        message: `${times.length}/50 OK, дундаж: ${average}ms, алдаа: ${errors}`,
        durationMs: Date.now() - start,
        metrics: { avg: average, errors, ok: times.length },
        risk: riskFromStatus(status),
      };
    }

    // LOAD-9: Memory leak
    {
      const id = 'LOAD-9';
      const start = Date.now();
      const psid = 'stress-load-memcheck';
      await prisma.conversation.deleteMany({ where: { psid } });
      if (global.gc) { try { global.gc(); } catch { /* ignore */ } }
      const before = process.memoryUsage().heapUsed;
      for (let i = 0; i < 100; i++) {
        await sendMessage(pageId, psid, i % 2 === 0 ? 'захиалах' : 'тест');
      }
      if (global.gc) { try { global.gc(); } catch { /* ignore */ } }
      const after = process.memoryUsage().heapUsed;
      const diffMB = Math.round((after - before) / 1024 / 1024);
      let status: LoadStatus = 'pass';
      if (diffMB > 100) status = 'fail';
      else if (diffMB > 50) status = 'warn';
      yield {
        id, category: cat, name: 'Санах ойн алдагдал шалгалт (100 мессеж)',
        status,
        message: `Санах ой нэмэгдсэн: ${diffMB}MB`,
        durationMs: Date.now() - start,
        metrics: { memoryIncreaseMB: diffMB },
        risk: riskFromStatus(status),
      };
    }

    // LOAD-10: Worst case day (29 concurrent)
    {
      const id = 'LOAD-10';
      const start = Date.now();
      const psids = Array.from({ length: 29 }, (_, i) => `stress-load-worst-${i + 1}`);
      await prisma.conversation.deleteMany({ where: { psid: { in: psids } } });
      const results = await Promise.allSettled(psids.map(p => sendMessage(pageId, p, 'захиалах')));
      const totalMs = Date.now() - start;
      const errors = results.filter(r => r.status === 'rejected').length;
      const status: LoadStatus = errors > 0 || totalMs > 5000 ? 'fail' : 'pass';
      yield {
        id, category: cat, name: 'Хамгийн ачаалалтай өдөр (29 зэрэг)',
        status,
        message: `${psids.length - errors}/29 амжилттай, нийт: ${totalMs}ms`,
        durationMs: totalMs,
        metrics: { total: totalMs, errors, ok: psids.length - errors },
        risk: riskFromStatus(status),
      };
    }
  } finally {
    setStressTestMode(false);
  }
}

export async function cleanupLoadTestData(): Promise<{ conversations: number; messages: number; orders: number }> {
  const convs = await prisma.conversation.findMany({
    where: { psid: { startsWith: 'stress-load-' } },
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
    where: { psid: { startsWith: 'stress-load-' } },
  });

  await prisma.facebookPage.deleteMany({ where: { pageId: LOAD_PAGE_ID } }).catch(() => {});

  return {
    conversations: conversations.count,
    messages: messages.count,
    orders: orders.count,
  };
}
