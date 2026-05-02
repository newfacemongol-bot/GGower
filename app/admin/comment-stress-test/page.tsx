'use client';

import { useMemo, useState } from 'react';
import { TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, Circle as XCircle, Play, Trash2, Loader as Loader2, MessageCircle } from 'lucide-react';

type TStatus = 'pass' | 'fail' | 'warn';

interface CResult {
  id: string;
  name: string;
  status: TStatus;
  message?: string;
  durationMs: number;
  metrics?: Record<string, number | string>;
}

export default function CommentStressTestPage() {
  const [results, setResults] = useState<CResult[]>([]);
  const [running, setRunning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupMsg, setCleanupMsg] = useState<string | null>(null);

  async function runTests() {
    setResults([]);
    setCleanupMsg(null);
    setRunning(true);
    try {
      const res = await fetch('/api/admin/comment-stress-test', { method: 'POST' });
      if (!res.ok || !res.body) { setRunning(false); return; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line) as CResult;
            setResults(prev => [...prev, parsed]);
          } catch { /* ignore */ }
        }
      }
    } finally {
      setRunning(false);
    }
  }

  async function cleanup() {
    if (!confirm('Коммент тест өгөгдлийг устгах уу? / Delete comment test data?')) return;
    setCleaning(true);
    setCleanupMsg(null);
    try {
      const res = await fetch('/api/admin/comment-stress-test/cleanup', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        const d = data.deleted ?? {};
        setCleanupMsg(`${d.comments ?? 0} коммент / comments, ${d.pages ?? 0} пэйж / pages устгагдлаа / deleted`);
      } else setCleanupMsg('Устгахад алдаа гарлаа / Error deleting');
    } finally {
      setCleaning(false);
    }
  }

  const summary = useMemo(() => {
    if (!results.length) return null;
    const pass = results.filter(r => r.status === 'pass').length;
    const fail = results.filter(r => r.status === 'fail').length;
    const percent = Math.round((pass / results.length) * 100);
    const canHandle = fail === 0;

    const neg = results.find(r => r.id === 'CTEST-5');
    const phone = results.find(r => r.id === 'CTEST-6');
    const negPct = typeof neg?.metrics?.percent === 'number' ? neg.metrics.percent : 0;
    const phoneOk = typeof phone?.metrics?.ok === 'number' ? phone.metrics.ok : 0;
    const phonePct = Math.round((phoneOk / 10) * 100);

    let fbRisk: 'БАГА' | 'ДУНД' | 'ӨНДӨР' = 'БАГА';
    if (fail > 0) fbRisk = 'ӨНДӨР';
    else if (results.some(r => r.status === 'warn')) fbRisk = 'ДУНД';

    return { pass, fail, percent, canHandle, fbRisk, negPct, phonePct };
  }, [results]);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-teal-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Коммент бот стресс тест / Comment bot stress test</h1>
          <p className="text-sm text-slate-600">
            Бодит өгөгдөл дээр үндэслэсэн: 30 пэйж, 1,719 коммент/өдөр, 72/цаг оргил / Based on real data: 30 pages, 1,719 comments/day, 72/hour peak
          </p>
        </div>
      </div>

      <div className="mb-6 border border-blue-200 bg-blue-50 rounded-lg p-4 text-sm text-blue-900">
        <p className="font-medium mb-1">Тестийн тохируулга / Test configuration:</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-800">
          <li>Бодит Facebook API дуудлага хийхгүй — бүх hide/like/reply mock / No real Facebook API calls — all hide/like/reply mocked</li>
          <li>Коммент ID / Comment ID: "stress-comment-*", Пэйж ID / Page ID: "stress-page-*"</li>
          <li>30% утас / 20% сөрөг / 50% энгийн хольцтой / 30% phone / 20% negative / 50% normal mix</li>
          <li>Шөнийн горим (22:00-09:00) дагалт шалгана / Night mode (22:00-09:00) compliance checked</li>
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          onClick={runTests}
          disabled={running}
          className="inline-flex items-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {running ? 'Ажиллаж байна... / Running...' : 'Коммент тест эхлэх / Start comment test'}
        </button>

        {results.length > 0 && !running && (
          <button
            onClick={cleanup}
            disabled={cleaning}
            className="inline-flex items-center gap-2 border border-red-300 text-red-700 px-4 py-2.5 rounded-lg hover:bg-red-50 disabled:opacity-50"
          >
            {cleaning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Коммент тест өгөгдөл устгах / Delete comment test data
          </button>
        )}

        {cleanupMsg && <span className="text-sm text-emerald-700 font-medium">{cleanupMsg}</span>}
      </div>

      {summary && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-5 gap-4">
          <SummaryCard label="30 пэйж даах чадвар / 30-page capacity" value={`${summary.percent}%`} sub={`${summary.pass}/${results.length} амжилттай / passed`} />
          <SummaryCard
            label="Өдөрт 1,719 коммент / 1,719 comments/day"
            value={summary.canHandle ? 'ТИЙМ / YES' : 'ҮГҮЙ / NO'}
            valueClass={summary.canHandle ? 'text-emerald-600' : 'text-red-600'}
          />
          <SummaryCard
            label="Facebook блок эрсдэл / Facebook block risk"
            value={summary.fbRisk}
            valueClass={summary.fbRisk === 'БАГА' ? 'text-emerald-600' : summary.fbRisk === 'ДУНД' ? 'text-amber-600' : 'text-red-600'}
          />
          <SummaryCard label="Сөрөг илрүүлэлт / Negative detection" value={`${summary.negPct}%`} />
          <SummaryCard label="Утас илрүүлэлт / Phone detection" value={`${summary.phonePct}%`} />
        </div>
      )}

      {results.length > 0 && (
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900 text-sm">Коммент тестийн үр дүн / Comment test results</h3>
          </div>
          <ul className="divide-y divide-slate-100">
            {results.map(r => (
              <li key={r.id} className="px-4 py-3 flex items-start gap-3">
                <StatusIcon status={r.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-slate-500">{r.id}</span>
                    <span className="text-sm font-medium text-slate-900">{r.name}</span>
                    <span className="ml-auto text-xs text-slate-400">{r.durationMs}мс</span>
                  </div>
                  {r.message && <div className="mt-1 text-xs text-slate-600">{r.message}</div>}
                  {r.metrics && (
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                      {Object.entries(r.metrics).map(([k, v]) => (
                        <span key={k} className="bg-slate-100 px-1.5 py-0.5 rounded">
                          {k}: <span className="text-slate-700 font-medium">{String(v)}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub, valueClass }: { label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${valueClass ?? 'text-slate-900'}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function StatusIcon({ status }: { status: TStatus }) {
  if (status === 'pass') return <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />;
  if (status === 'fail') return <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />;
  return <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />;
}
