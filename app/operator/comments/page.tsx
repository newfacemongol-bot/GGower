'use client';

import { useEffect, useState } from 'react';
import { Phone, CircleCheck as CheckCircle2, Circle as XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface CommentItem {
  id: string;
  commentText: string;
  senderName?: string | null;
  pageName?: string | null;
  extractedPhone?: string | null;
  productCode?: string | null;
  intent?: string | null;
  status: string;
  queuedAt: string;
  createdAt: string;
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  queued: { label: 'Хүлээлтэд', cls: 'bg-amber-100 text-amber-700' },
  sent: { label: 'Илгээсэн', cls: 'bg-blue-100 text-blue-700' },
  skipped: { label: 'Алгассан', cls: 'bg-slate-200 text-slate-600' },
  failed: { label: 'Алдаа', cls: 'bg-red-100 text-red-700' },
  CALLED: { label: 'Дуудсан', cls: 'bg-sky-100 text-sky-700' },
  CONFIRMED: { label: 'Захиалга болсон', cls: 'bg-emerald-100 text-emerald-700' },
  NOT_INTERESTED: { label: 'Болохгүй', cls: 'bg-rose-100 text-rose-700' },
};

export default function OperatorCommentsPage() {
  const [items, setItems] = useState<CommentItem[]>([]);
  const [status, setStatus] = useState('');
  const [hasPhone, setHasPhone] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (hasPhone) params.set('hasPhone', hasPhone);
    const r = await fetch(`/api/operator/comments?${params}`);
    const d = await r.json();
    setItems(d.items || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [status, hasPhone]);

  async function updateStatus(id: string, newStatus: string) {
    const r = await fetch(`/api/operator/comments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!r.ok) {
      toast.error('Алдаа гарлаа');
      return;
    }
    toast.success('Шинэчлэгдлээ');
    load();
  }

  return (
    <div className="h-screen overflow-auto">
      <div className="p-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Коммент</h1>
          <span className="text-sm text-slate-500">{items.length} бичлэг</span>
        </div>

        <div className="flex flex-wrap gap-3 mb-4">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
          >
            <option value="">Бүх төлөв</option>
            <option value="queued">Хүлээлтэд</option>
            <option value="sent">Илгээсэн</option>
            <option value="CALLED">Дуудсан</option>
            <option value="CONFIRMED">Захиалга болсон</option>
            <option value="NOT_INTERESTED">Болохгүй</option>
            <option value="skipped">Алгассан</option>
            <option value="failed">Алдаа</option>
          </select>
          <select
            value={hasPhone}
            onChange={(e) => setHasPhone(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
          >
            <option value="">Бүгд</option>
            <option value="1">Утастай</option>
            <option value="0">Утасгүй</option>
          </select>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-200">
          {items.map((c) => {
            const s = STATUS_LABELS[c.status] || { label: c.status, cls: 'bg-slate-200 text-slate-600' };
            return (
              <div key={c.id} className="p-4 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-slate-900">
                      {c.senderName || 'Unknown'}
                    </span>
                    {c.pageName && (
                      <span className="text-xs text-slate-500">· {c.pageName}</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded ${s.cls}`}>{s.label}</span>
                  </div>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap break-words">
                    {c.commentText}
                  </div>
                  <div className="text-xs text-slate-500 mt-2 flex flex-wrap gap-3">
                    <span>{new Date(c.queuedAt || c.createdAt).toLocaleString('mn-MN')}</span>
                    {c.extractedPhone && (
                      <span className="text-slate-700 font-medium">Утас: {c.extractedPhone}</span>
                    )}
                    {c.productCode && <span>Код: {c.productCode}</span>}
                    {c.intent && <span>Intent: {c.intent}</span>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 md:shrink-0">
                  <button
                    onClick={() => updateStatus(c.id, 'CALLED')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-sky-200 text-sky-700 bg-sky-50 hover:bg-sky-100 transition"
                  >
                    <Phone className="w-3.5 h-3.5" /> Дуудах
                  </button>
                  <button
                    onClick={() => updateStatus(c.id, 'CONFIRMED')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Захиалга болсон
                  </button>
                  <button
                    onClick={() => updateStatus(c.id, 'NOT_INTERESTED')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 transition"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Болохгүй
                  </button>
                </div>
              </div>
            );
          })}
          {!items.length && !loading && (
            <div className="p-10 text-center text-slate-500 text-sm">Коммент байхгүй</div>
          )}
          {loading && !items.length && (
            <div className="p-10 text-center text-slate-400 text-sm">Ачаалж байна...</div>
          )}
        </div>
      </div>
    </div>
  );
}
