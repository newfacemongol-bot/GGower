'use client';

import { useMemo, useState } from 'react';
import { TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, Circle as XCircle, Play, Trash2, Download, Loader as Loader2 } from 'lucide-react';

type TestStatus = 'pass' | 'fail' | 'warn';

interface TestResult {
  id: string;
  category: string;
  name: string;
  status: TestStatus;
  expected?: unknown;
  actual?: unknown;
  message?: string;
  durationMs: number;
}

export default function StressTestPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupMsg, setCleanupMsg] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);

  const totals = useMemo(() => {
    const pass = results.filter((r) => r.status === 'pass').length;
    const fail = results.filter((r) => r.status === 'fail').length;
    const warn = results.filter((r) => r.status === 'warn').length;
    return { pass, fail, warn, total: results.length };
  }, [results]);

  const byCategory = useMemo(() => {
    const map = new Map<string, TestResult[]>();
    for (const r of results) {
      if (!map.has(r.category)) map.set(r.category, []);
      map.get(r.category)!.push(r);
    }
    return Array.from(map.entries());
  }, [results]);

  async function runTests() {
    setResults([]);
    setCleanupMsg(null);
    setRunning(true);
    setStartedAt(Date.now());
    setFinishedAt(null);

    try {
      const res = await fetch('/api/admin/stress-test', { method: 'POST' });
      if (!res.ok || !res.body) {
        setRunning(false);
        return;
      }
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
            const parsed = JSON.parse(line) as TestResult;
            setResults((prev) => [...prev, parsed]);
          } catch {
            /* ignore */
          }
        }
      }
    } finally {
      setRunning(false);
      setFinishedAt(Date.now());
    }
  }

  async function cleanup() {
    if (!confirm('Тест өгөгдлийг бүгдийг устгах уу? Энэ үйлдлийг буцаах боломжгүй.')) return;
    setCleaning(true);
    setCleanupMsg(null);
    try {
      const res = await fetch('/api/admin/stress-test/cleanup', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        const d = data.deleted ?? {};
        setCleanupMsg(
          `${d.conversations ?? 0} харилцан яриа, ${d.messages ?? 0} мессеж, ${d.orders ?? 0} захиалга устгагдлаа`,
        );
      } else {
        setCleanupMsg('Устгахад алдаа гарлаа');
      }
    } finally {
      setCleaning(false);
    }
  }

  function exportJson() {
    const payload = {
      startedAt,
      finishedAt,
      totals,
      results,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stress-test-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const duration = startedAt && finishedAt ? finishedAt - startedAt : 0;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Стресс тест</h1>
        <p className="text-sm text-slate-600 mt-1">
          Chatbot-ийн бүх үндсэн логикийг шалгах автомат тест
        </p>
      </div>

      <div className="mb-6 border border-amber-200 bg-amber-50 rounded-lg p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900">
          <p className="font-medium">Стресс тест нь ERP-д захиалга үүсгэхгүй.</p>
          <p>Зөвхөн chatbot-ийн логикийг шалгана. Тест дуусаад өгөгдлийг устгаж болно.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          onClick={runTests}
          disabled={running}
          className="inline-flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {running ? 'Ажиллаж байна...' : 'Стресс тест эхлэх'}
        </button>

        {results.length > 0 && !running && (
          <>
            <button
              onClick={exportJson}
              className="inline-flex items-center gap-2 border border-slate-300 text-slate-700 px-4 py-2.5 rounded-lg hover:bg-slate-100"
            >
              <Download className="w-4 h-4" /> JSON татах
            </button>
            <button
              onClick={cleanup}
              disabled={cleaning}
              className="inline-flex items-center gap-2 border border-red-300 text-red-700 px-4 py-2.5 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              {cleaning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Тест өгөгдлийг устгах
            </button>
          </>
        )}

        {cleanupMsg && <span className="text-sm text-emerald-700 font-medium">{cleanupMsg}</span>}
      </div>

      {(running || results.length > 0) && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <Stat label="Нийт" value={totals.total} color="slate" />
          <Stat label="Амжилттай" value={totals.pass} color="emerald" />
          <Stat label="Амжилтгүй" value={totals.fail} color="red" />
          <Stat label="Анхааруулга" value={totals.warn} color="amber" />
          <Stat label="Хугацаа" value={`${duration}мс`} color="slate" />
        </div>
      )}

      <div className="space-y-6">
        {byCategory.map(([category, items]) => (
          <div key={category} className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 text-sm">{category}</h3>
              <span className="text-xs text-slate-500">
                {items.filter((i) => i.status === 'pass').length}/{items.length}
              </span>
            </div>
            <ul className="divide-y divide-slate-100">
              {items.map((r) => (
                <li key={r.id} className="px-4 py-2.5 flex items-start gap-3">
                  <StatusIcon status={r.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-500">{r.id}</span>
                      <span className="text-sm text-slate-900">{r.name}</span>
                      <span className="ml-auto text-xs text-slate-400">{r.durationMs}мс</span>
                    </div>
                    {r.status !== 'pass' && (r.message || r.expected !== undefined) && (
                      <div className="mt-1 text-xs text-slate-600 space-y-0.5">
                        {r.message && <div>{r.message}</div>}
                        {r.expected !== undefined && (
                          <div>
                            <span className="text-slate-500">expected:</span>{' '}
                            <code className="bg-slate-100 px-1 rounded">{String(JSON.stringify(r.expected))}</code>
                          </div>
                        )}
                        {r.actual !== undefined && (
                          <div>
                            <span className="text-slate-500">actual:</span>{' '}
                            <code className="bg-slate-100 px-1 rounded">{String(JSON.stringify(r.actual))}</code>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: TestStatus }) {
  if (status === 'pass') return <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />;
  if (status === 'fail') return <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />;
  return <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />;
}

function Stat({ label, value, color }: { label: string; value: string | number; color: 'slate' | 'emerald' | 'red' | 'amber' }) {
  const map = {
    slate: 'text-slate-900',
    emerald: 'text-emerald-600',
    red: 'text-red-600',
    amber: 'text-amber-600',
  } as const;
  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-white">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl font-bold ${map[color]}`}>{value}</div>
    </div>
  );
}
