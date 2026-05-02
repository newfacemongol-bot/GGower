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

    // LOAD-1: Single Message Performance (<684ms = real peak requirement)
    {
      const id = 'LOAD-1';
      const start = Date.now();
      let status: LoadStatus = 'pass';
      let message = '';
      const psid = 'stress-load-single';
      try {
        await prisma.conversation.deleteMany({ where: { psid } });
        const ms = await sendMessage(pageId, psid, 'захиалах');
        if (ms > 2000) { status = 'fail'; message = `${ms}ms > 2000ms`; }
        else if (ms > 684) { status = 'warn'; message = `${ms}ms > 684ms (оргил цагийн хязгаар)`; }
        else { message = `${ms}ms (оргил шаардлага: <684ms)`; }
        yield {
          id, category: cat, name: '1 мессеж боловсруулах (<684ms)',
          status, message, durationMs: Date.now() - start,
          metrics: { responseMs: ms, peakLimit: 684 },
          risk: riskFromStatus(status),
        };
      } catch (e) {
        yield { id, category: cat, name: '1 мессеж боловсруулах (<684ms)',
          status: 'fail', message: (e as Error).message, durationMs: Date.now() - start,
          risk: 'danger' };
      }
    }

    // LOAD-2: 1 real chat session (avg 6.2 messages per chat)
    {
      const id = 'LOAD-2';
      const start = Date.now();
      const psid = 'stress-load-seq';
      await prisma.conversation.deleteMany({ where: { psid } });
      const msgs = ['захиалах', '0116', '1', '88778877', 'Улаанбаатар', 'БЗД'];
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
      const total = Date.now() - start;
      let status: LoadStatus = 'pass';
      let message = `Дундаж: ${average}ms, Нийт: ${total}ms`;
      if (failed) { status = 'fail'; message = errMsg; }
      else if (total > 4000 || average > 684) { status = failed ? 'fail' : (average > 2000 ? 'fail' : 'warn'); }
      yield {
        id, category: cat, name: '1 бодит харилцан яриа (6 мессеж)',
        status, message, durationMs: total,
        metrics: { avg: average, total, count: times.length },
        risk: riskFromStatus(status),
      };
    }

    // LOAD-3: Peak hour - 88 msgs/min in realistic bursts (5 every 3.4 sec)
    {
      const id = 'LOAD-3';
      const start = Date.now();
      const psids = Array.from({ length: 88 }, (_, i) => `stress-load-${i + 1}`);
      await prisma.conversation.deleteMany({ where: { psid: { in: psids } } });
      const allTimes: number[] = [];
      let errors = 0;
      const batchSize = 5;
      for (let i = 0; i < psids.length; i += batchSize) {
        const batch = psids.slice(i, i + batchSize);
        const results = await Promise.allSettled(batch.map(p => sendMessage(pageId, p, 'захиалах')));
        results.forEach(r => {
          if (r.status === 'fulfilled') allTimes.push(r.value);
          else errors++;
        });
        if (i + batchSize < psids.length) await new Promise(res => setTimeout(res, 3400));
      }
      const fast = allTimes.filter(t => t < 2000).length;
      const slowest = allTimes.length ? Math.max(...allTimes) : 0;
      const pct = Math.round((fast / psids.length) * 100);
      let status: LoadStatus = 'pass';
      if (errors > 0 || pct < 80) status = 'fail';
      else if (pct < 95) status = 'warn';
      yield {
        id, category: cat, name: '30 пэйж оргил (88 мессеж/мин цуваа)',
        status,
        message: `${fast}/88 хурдан (<2с), удаан: ${slowest}ms, ${pct}%, алдаа: ${errors}`,
        durationMs: Date.now() - start,
        metrics: { fastCount: fast, slowest, percent: pct, avg: avg(allTimes), errors },
        risk: riskFromStatus(status),
      };
    }

    // LOAD-4: ERP search - 72 simultaneous (real daily volume)
    {
      const id = 'LOAD-4';
      const start = Date.now();
      const cfg = await getErpCfg();
      if (!cfg) {
        yield { id, category: cat, name: 'ERP хайлтын ачаалал', status: 'warn',
          message: 'ERP тохиргоо хийгдээгүй', durationMs: Date.now() - start, risk: 'caution' };
      } else {
        const baseQueries = ['0116', '0117', '0118', 'дэвтэр', 'шарагч', 'үдээс', 'саарал', 'ягаан', '99999', 'сав', 'тест', 'хайх'];
        const queries = Array.from({ length: 72 }, (_, i) => baseQueries[i % baseQueries.length]);
        const times: number[] = [];
        let errors = 0;
        const results = await Promise.allSettled(queries.map(async (q) => {
          const t0 = Date.now();
          await erpSearchProducts(cfg, q, 5);
          return Date.now() - t0;
        }));
        results.forEach(r => { if (r.status === 'fulfilled') times.push(r.value); else errors++; });
        const average = avg(times);
        const slowest = times.length ? Math.max(...times) : 0;
        let status: LoadStatus = 'pass';
        if (errors > 0 || average > 1000) status = 'fail';
        else if (average > 300) status = 'warn';
        yield {
          id, category: cat, name: 'ERP хайлт (72 зэрэг - өдрийн ачаалал)',
          status,
          message: `Дундаж: ${average}ms, удаан: ${slowest}ms, алдаа: ${errors}`,
          durationMs: Date.now() - start,
          metrics: { avg: average, slowest, count: times.length, errors },
          risk: riskFromStatus(status),
        };
      }
    }

    // LOAD-5: Comment processing - 300 comments (peak hour 30 pages)
    {
      const id = 'LOAD-5';
      const start = Date.now();
      const comments = Array.from({ length: 300 }, (_, i) => {
        if (i % 10 === 0) return 'залилсан худал бараа';
        if (i % 5 === 0) return '88778877 авна';
        return `бараа ${i} авмаар байна`;
      });
      let errors = 0;
      const times: number[] = [];
      for (const c of comments) {
        try {
          const t0 = Date.now();
          extractSlots(c, { productSelected: false, wantPhone: true });
          detectNegative(c);
          times.push(Date.now() - t0);
        } catch { errors++; }
      }
      const totalMs = Date.now() - start;
      const average = avg(times);
      let status: LoadStatus = 'pass';
      if (errors > 0 || totalMs > 30000) status = 'fail';
      else if (average > 100) status = 'warn';
      yield {
        id, category: cat, name: 'Коммент боловсруулалт (300/цаг)',
        status,
        message: `${comments.length - errors}/300 OK, дундаж: ${average}ms, нийт: ${totalMs}ms`,
        durationMs: totalMs,
        metrics: { avg: average, count: comments.length, total: totalMs, errors },
        risk: riskFromStatus(status),
      };
    }

    // LOAD-6: Real load - 45 messages in 30 seconds (1.5/sec)
    {
      const id = 'LOAD-6';
      const start = Date.now();
      const memBefore = process.memoryUsage().heapUsed;
      const psids = Array.from({ length: 45 }, (_, i) => `stress-load-p6-${i + 1}`);
      await prisma.conversation.deleteMany({ where: { psid: { in: psids } } });
      const allTimes: number[] = [];
      let processed = 0;
      let errors = 0;
      const batchSize = 3;
      for (let i = 0; i < psids.length; i += batchSize) {
        const batch = psids.slice(i, i + batchSize);
        const results = await Promise.allSettled(batch.map(p => sendMessage(pageId, p, 'захиалах')));
        results.forEach(r => {
          if (r.status === 'fulfilled') { allTimes.push(r.value); processed++; }
          else errors++;
        });
        if (i + batchSize < psids.length) await new Promise(res => setTimeout(res, 2000));
      }
      const average = avg(allTimes);
      const memAfter = process.memoryUsage().heapUsed;
      const successPct = Math.round((processed / psids.length) * 100);
      let status: LoadStatus = 'pass';
      if (errors > 0 || average > 2000) status = 'fail';
      else if (average > 1000) status = 'warn';
      yield {
        id, category: cat, name: '1 өдрийн ачаалал (45 мессеж/30сек = 1.5/с)',
        status,
        message: `${processed}/45 амжилттай (${successPct}%), дундаж: ${average}ms, алдаа: ${errors}`,
        durationMs: Date.now() - start,
        metrics: {
          processed, errors, avg: average, percent: successPct,
          memoryMB: Math.round((memAfter - memBefore) / 1024 / 1024),
        },
        risk: riskFromStatus(status),
      };
    }

    // LOAD-7: Facebook rate limit safety - 5 real checks
    {
      const id = 'LOAD-7';
      const start = Date.now();
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // CHECK 1: Hourly comment limit per page
      const hourly = await prisma.commentLead.groupBy({
        by: ['pageId'],
        where: {
          sentAt: { gt: oneHourAgo },
          replied: true,
        },
        _count: { _all: true },
      });
      const maxHourly = hourly.reduce((m, r) => Math.max(m, r._count._all), 0);
      let check1: LoadStatus = 'pass';
      if (maxHourly > 40) check1 = 'fail';
      else if (maxHourly > 30) check1 = 'warn';

      // CHECK 2: Daily comment limit per page
      const daily = await prisma.commentLead.groupBy({
        by: ['pageId'],
        where: {
          sentAt: { gt: oneDayAgo },
          replied: true,
        },
        _count: { _all: true },
      });
      const maxDaily = daily.reduce((m, r) => Math.max(m, r._count._all), 0);
      let check2: LoadStatus = 'pass';
      if (maxDaily > 500) check2 = 'fail';
      else if (maxDaily > 400) check2 = 'warn';

      // CHECK 3: Night mode compliance (Mongolia = UTC+8)
      const mnHour = (new Date().getUTCHours() + 8) % 24;
      const isNight = mnHour >= 22 || mnHour < 9;
      let check3: LoadStatus = 'pass';
      let nightMsg = 'Өдрийн цаг';
      if (isNight) {
        const recentNightSends = await prisma.commentLead.count({
          where: {
            sentAt: { gt: oneHourAgo },
            replied: true,
            scheduledFor: null,
          },
        });
        if (recentNightSends > 0) check3 = 'fail';
        nightMsg = `Шөнийн горим (${recentNightSends} илгээлт)`;
      }

      // CHECK 4: Reply delay between consecutive replies
      const lastReplies = await prisma.commentLead.findMany({
        where: { replied: true, sentAt: { not: null } },
        orderBy: { sentAt: 'desc' },
        take: 10,
        select: { sentAt: true, pageId: true },
      });
      let minDelaySec = Infinity;
      for (let i = 0; i < lastReplies.length - 1; i++) {
        const a = lastReplies[i].sentAt;
        const b = lastReplies[i + 1].sentAt;
        if (a && b) {
          const d = Math.abs(a.getTime() - b.getTime()) / 1000;
          if (d < minDelaySec) minDelaySec = d;
        }
      }
      let check4: LoadStatus = 'pass';
      if (lastReplies.length >= 2) {
        if (minDelaySec < 10) check4 = 'fail';
        else if (minDelaySec < 30) check4 = 'warn';
      }

      // CHECK 5: Page rotation (no consecutive same page)
      const last20 = await prisma.commentLead.findMany({
        where: { replied: true, sentAt: { not: null } },
        orderBy: { sentAt: 'desc' },
        take: 20,
        select: { pageId: true },
      });
      let consecutiveSame = 0;
      for (let i = 0; i < last20.length - 1; i++) {
        if (last20[i].pageId === last20[i + 1].pageId) consecutiveSame++;
      }
      const check5: LoadStatus = consecutiveSame > 0 ? 'warn' : 'pass';

      const checks = [check1, check2, check3, check4, check5];
      const failCount = checks.filter(c => c === 'fail').length;
      const warnCount = checks.filter(c => c === 'warn').length;
      let status: LoadStatus = 'pass';
      let risk: 'safe' | 'caution' | 'danger' = 'safe';
      if (failCount > 0) { status = 'fail'; risk = 'danger'; }
      else if (warnCount > 0) { status = warnCount >= 1 ? 'warn' : 'pass'; risk = 'caution'; }

      yield {
        id, category: cat, name: 'Facebook блок эрсдэл (5 шалгалт)',
        status,
        message: `Цагт дээд: ${maxHourly}/40, Өдөрт: ${maxDaily}/500, ${nightMsg}, Мин саатал: ${isFinite(minDelaySec) ? minDelaySec.toFixed(1) + 'с' : 'N/A'}, Дараалал: ${consecutiveSame === 0 ? 'OK' : consecutiveSame + ' давхар'}`,
        durationMs: Date.now() - start,
        metrics: {
          maxHourly,
          maxDaily,
          nightMode: isNight ? 'идэвхтэй' : 'унтарсан',
          minDelaySec: isFinite(minDelaySec) ? Math.round(minDelaySec) : 0,
          consecutivePages: consecutiveSame,
          pagesChecked: hourly.length,
        },
        risk,
      };
    }

    // LOAD-8: DB stress - 107 queries (real peak volume)
    {
      const id = 'LOAD-8';
      const start = Date.now();
      const ops: Promise<number>[] = [];
      for (let i = 0; i < 107; i++) {
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
      if (errors > 0) status = 'fail';
      else if (average > 100) status = 'warn';
      yield {
        id, category: cat, name: 'DB стресс (107 зэрэг - оргил минут)',
        status,
        message: `${times.length}/107 OK, дундаж: ${average}ms, алдаа: ${errors}`,
        durationMs: Date.now() - start,
        metrics: { avg: average, errors, ok: times.length },
        risk: riskFromStatus(status),
      };
    }

    // LOAD-9: Memory over real session (200 messages)
    {
      const id = 'LOAD-9';
      const start = Date.now();
      const psid = 'stress-load-memcheck';
      await prisma.conversation.deleteMany({ where: { psid } });
      if (global.gc) { try { global.gc(); } catch { /* ignore */ } }
      const before = process.memoryUsage().heapUsed;
      for (let i = 0; i < 200; i++) {
        await sendMessage(pageId, psid, i % 2 === 0 ? 'захиалах' : 'тест');
      }
      if (global.gc) { try { global.gc(); } catch { /* ignore */ } }
      const after = process.memoryUsage().heapUsed;
      const diffMB = Math.round((after - before) / 1024 / 1024);
      let status: LoadStatus = 'pass';
      if (diffMB > 200) status = 'fail';
      else if (diffMB > 100) status = 'warn';
      yield {
        id, category: cat, name: 'Санах ой (200 мессеж - бодит сешн)',
        status,
        message: `Санах ой нэмэгдсэн: ${diffMB}MB`,
        durationMs: Date.now() - start,
        metrics: { memoryIncreaseMB: diffMB, messages: 200 },
        risk: riskFromStatus(status),
      };
    }

    // LOAD-10: Worst day - 60 concurrent (2 minutes of worst day)
    {
      const id = 'LOAD-10';
      const start = Date.now();
      const psids = Array.from({ length: 60 }, (_, i) => `stress-load-worst-${i + 1}`);
      await prisma.conversation.deleteMany({ where: { psid: { in: psids } } });
      const results = await Promise.allSettled(psids.map(p => sendMessage(pageId, p, 'захиалах')));
      const totalMs = Date.now() - start;
      const errors = results.filter(r => r.status === 'rejected').length;
      const status: LoadStatus = errors > 0 || totalMs > 5000 ? 'fail' : 'pass';
      yield {
        id, category: cat, name: 'Хамгийн ачаалалтай өдөр (60 зэрэг/2мин)',
        status,
        message: `${psids.length - errors}/60 амжилттай, нийт: ${totalMs}ms`,
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
