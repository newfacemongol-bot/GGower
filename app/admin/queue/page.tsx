'use client';

import { useEffect, useState } from 'react';

export default function QueuePage() {
  const [items, setItems] = useState<any[]>([]);
  const [pages, setPages] = useState<any[]>([]);

  async function load() {
    const r = await fetch('/api/admin/queue');
    const d = await r.json();
    setItems(d.items || []); setPages(d.pages || []);
  }
  useEffect(() => { load(); const id = setInterval(load, 10000); return () => clearInterval(id); }, []);

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Дараалал / Queue</h1>
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {pages.map((p) => {
          const count = items.filter((i) => i.pageId === p.pageId).length;
          return (
            <div key={p.pageId} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-xs text-slate-500 uppercase">{p.pageName}</div>
              <div className="text-3xl font-bold text-slate-900 mt-1">{count}</div>
              <div className="text-xs text-slate-600 mt-1">хязгаар / limit: {p.hourlyCommentLimit}/цаг / hr</div>
            </div>
          );
        })}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-200">
        {items.map((c) => (
          <div key={c.id} className="p-4">
            <div className="text-sm font-medium text-slate-900">{c.senderName || 'Unknown'}</div>
            <div className="text-sm text-slate-700 mt-0.5">{c.commentText}</div>
            <div className="text-xs text-slate-500 mt-1">Илгээх цаг / Scheduled at: {c.scheduledFor ? new Date(c.scheduledFor).toLocaleString('mn-MN') : '—'}</div>
          </div>
        ))}
        {!items.length && <div className="p-8 text-center text-slate-500 text-sm">Queue хоосон / Queue is empty</div>}
      </div>
    </div>
  );
}
