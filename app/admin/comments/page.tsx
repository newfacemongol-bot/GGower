'use client';

import { useEffect, useState } from 'react';
import { Archive, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';

interface CommentItem {
  id: string; commentText: string; senderName?: string | null;
  pageId: string; extractedPhone?: string | null; productCode?: string | null;
  status: string; queuedAt: string; repliedAt?: string | null;
  isArchived?: boolean;
}

export default function CommentsPage() {
  const [items, setItems] = useState<CommentItem[]>([]);
  const [status, setStatus] = useState('');
  const [phone, setPhone] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  async function load() {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (phone) params.set('phone', phone);
    if (showArchived) params.set('archived', '1');
    if (search) params.set('search', search);
    params.set('page', String(page));
    const r = await fetch(`/api/admin/comments?${params}`);
    const d = await r.json();
    setItems(d.items || []);
    if (typeof d.totalPages === 'number') setTotalPages(d.totalPages);
    if (typeof d.total === 'number') setTotal(d.total);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status, showArchived, page, search]);

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Коммент / Comments</h1>
        <span className="text-sm text-slate-500">{total.toLocaleString()} бичлэг / records</span>
      </div>
      <div className="flex flex-wrap gap-3 mb-4">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
          <option value="">Бүгд / All</option>
          <option value="queued">Дараалалд / Queued</option>
          <option value="sent">Илгээсэн / Sent</option>
          <option value="skipped">Алгассан / Skipped</option>
          <option value="failed">Алдаа / Failed</option>
        </select>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Утас / Phone..." className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); setPage(1); }} className="relative flex-1 min-w-[200px]">
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
        <button onClick={() => { setPage(1); load(); }} className="px-4 py-2 bg-slate-900 text-white text-sm rounded-lg">Шүүх / Filter</button>
        <button
          onClick={() => { setShowArchived(v => !v); setPage(1); }}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition ${showArchived ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
        >
          <Archive className="w-4 h-4" /> Архив харах / Show archive
        </button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-200">
        {items.map((c) => (
          <div key={c.id} className="p-4 flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-900">{c.senderName || 'Unknown'}</div>
              <div className="text-sm text-slate-700 mt-0.5">{c.commentText}</div>
              <div className="text-xs text-slate-500 mt-1 flex gap-3 flex-wrap">
                <span>{new Date(c.queuedAt).toLocaleString('mn-MN')}</span>
                {c.extractedPhone && <span>Утас / Phone: {c.extractedPhone}</span>}
                {c.productCode && <span>Код / Code: {c.productCode}</span>}
                {c.isArchived && <span className="text-slate-400">Архивлагдсан / Archived</span>}
              </div>
            </div>
            <span className={`text-xs px-2 py-1 rounded ${
              c.status === 'sent' ? 'bg-emerald-100 text-emerald-700' :
              c.status === 'queued' ? 'bg-amber-100 text-amber-700' :
              c.status === 'failed' ? 'bg-red-100 text-red-700' :
              'bg-slate-200 text-slate-600'
            }`}>{c.status}</span>
          </div>
        ))}
        {!items.length && <div className="p-8 text-center text-slate-500 text-sm">Коммент байхгүй / No comments</div>}
      </div>
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
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
