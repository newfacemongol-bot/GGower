'use client';

import { useEffect, useState } from 'react';

interface CommentItem {
  id: string; commentText: string; senderName?: string | null;
  pageId: string; extractedPhone?: string | null; productCode?: string | null;
  status: string; queuedAt: string; repliedAt?: string | null;
}

export default function CommentsPage() {
  const [items, setItems] = useState<CommentItem[]>([]);
  const [status, setStatus] = useState('');
  const [phone, setPhone] = useState('');

  async function load() {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (phone) params.set('phone', phone);
    const r = await fetch(`/api/admin/comments?${params}`);
    const d = await r.json();
    setItems(d.items || []);
  }
  useEffect(() => { load(); }, [status]);

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Коммент</h1>
      <div className="flex gap-3 mb-4">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
          <option value="">Бүгд</option>
          <option value="queued">Queue</option>
          <option value="sent">Илгээсэн</option>
          <option value="skipped">Алгассан</option>
          <option value="failed">Алдаа</option>
        </select>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Утас хайх..." className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        <button onClick={load} className="px-4 py-2 bg-slate-900 text-white text-sm rounded-lg">Шүүх</button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-200">
        {items.map((c) => (
          <div key={c.id} className="p-4 flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-900">{c.senderName || 'Unknown'}</div>
              <div className="text-sm text-slate-700 mt-0.5">{c.commentText}</div>
              <div className="text-xs text-slate-500 mt-1 flex gap-3">
                <span>{new Date(c.queuedAt).toLocaleString('mn-MN')}</span>
                {c.extractedPhone && <span>Утас: {c.extractedPhone}</span>}
                {c.productCode && <span>Код: {c.productCode}</span>}
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
        {!items.length && <div className="p-8 text-center text-slate-500 text-sm">Коммент байхгүй</div>}
      </div>
    </div>
  );
}
