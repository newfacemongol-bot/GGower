'use client';

import { useEffect, useState } from 'react';
import { Phone, CircleCheck as CheckCircle2, Circle as XCircle, Archive, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
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
  queued: { label: 'Хүлээлтэд / Queued', cls: 'bg-amber-100 text-amber-700' },
  sent: { label: 'Илгээсэн / Sent', cls: 'bg-blue-100 text-blue-700' },
  skipped: { label: 'Алгассан / Skipped', cls: 'bg-slate-200 text-slate-600' },
  failed: { label: 'Алдаа / Failed', cls: 'bg-red-100 text-red-700' },
  CALLED: { label: 'Дуудсан / Called', cls: 'bg-sky-100 text-sky-700' },
  CONFIRMED: { label: 'Захиалга болсон / Confirmed', cls: 'bg-emerald-100 text-emerald-700' },
  NOT_INTERESTED: { label: 'Болохгүй / Not interested', cls: 'bg-rose-100 text-rose-700' },
};

export default function OperatorCommentsPage() {
  const [items, setItems] = useState<CommentItem[]>([]);
  const [status, setStatus] = useState('');
  const [hasPhone, setHasPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (hasPhone) params.set('hasPhone', hasPhone);
    if (showArchived) params.set('archived', '1');
    if (search) params.set('search', search);
    params.set('page', String(page));
    const r = await fetch(`/api/operator/comments?${params}`);
    const d = await r.json();
    setItems(d.items || []);
    if (typeof d.totalPages === 'number') setTotalPages(d.totalPages);
    if (typeof d.total === 'number') setTotal(d.total);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, hasPhone, showArchived, page, search]);

  async function updateStatus(id: string, newStatus: string) {
    const r = await fetch(`/api/operator/comments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!r.ok) {
      toast.error('Алдаа гарлаа / Error');
      return;
    }
    toast.success('Шинэчлэгдлээ / Updated');
    load();
  }

  return (
    <div className="h-screen overflow-auto">
      <div className="p-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Needs Attention</h1>
          <span className="text-sm text-slate-500">{total.toLocaleString()} бичлэг / records</span>
        </div>

        <div className="flex flex-wrap gap-3 mb-4">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
          >
            <option value="">Бүх төлөв / All statuses</option>
            <option value="queued">Хүлээлтэд / Queued</option>
            <option value="sent">Илгээсэн / Sent</option>
            <option value="CALLED">Дуудсан / Called</option>
            <option value="CONFIRMED">Захиалга болсон / Confirmed</option>
            <option value="NOT_INTERESTED">Болохгүй / Not interested</option>
            <option value="skipped">Алгассан / Skipped</option>
            <option value="failed">Алдаа / Failed</option>
          </select>
          <select
            value={hasPhone}
            onChange={(e) => { setHasPhone(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
          >
            <option value="">Бүгд / All</option>
            <option value="1">Утастай / With phone</option>
            <option value="0">Утасгүй / No phone</option>
          </select>
          <form
            onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); setPage(1); }}
            className="relative flex-1 min-w-[200px]"
          >
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Текст, нэр, утасаар хайх / Search text, name, phone..."
              className="w-full pl-8 pr-8 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
            {search && (
              <button type="button" onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>
          <button
            onClick={() => { setShowArchived(v => !v); setPage(1); }}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition ${showArchived ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
          >
            <Archive className="w-4 h-4" /> {showArchived ? 'Архив / Archive' : 'Архив харах / Show archive'}
          </button>
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
                      <span className="text-slate-700 font-medium">Утас / Phone: {c.extractedPhone}</span>
                    )}
                    {c.productCode && <span>Код / Code: {c.productCode}</span>}
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
            <div className="p-10 text-center text-slate-500 text-sm">No items</div>
          )}
          {loading && !items.length && (
            <div className="p-10 text-center text-slate-400 text-sm">Ачаалж байна...</div>
          )}
        </div>

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const pages: (number | '...')[] = [];
  const add = (n: number | '...') => pages.push(n);
  const range = (a: number, b: number) => { for (let i = a; i <= b; i++) add(i); };
  if (totalPages <= 7) range(1, totalPages);
  else {
    add(1);
    if (page > 4) add('...');
    const s = Math.max(2, page - 1);
    const e = Math.min(totalPages - 1, page + 1);
    range(s, e);
    if (page < totalPages - 3) add('...');
    add(totalPages);
  }
  return (
    <div className="flex items-center justify-center gap-1 mt-4">
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="w-8 h-8 flex items-center justify-center rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`e${i}`} className="px-2 text-sm text-slate-400">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`min-w-[32px] h-8 px-2 text-sm rounded border ${p === page ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
          >
            {p}
          </button>
        ),
      )}
      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="w-8 h-8 flex items-center justify-center rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
