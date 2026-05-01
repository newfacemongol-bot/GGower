'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

interface PageItem {
  id: string; pageId: string; pageName: string; accessToken: string;
  isActive: boolean; autoReplyEnabled: boolean; hourlyCommentLimit: number;
  reactionEnabled: boolean; erpConfigId: string | null;
  erpConfig?: { id: string; name: string } | null;
}

interface ErpItem { id: string; name: string; }

export default function PagesAdminPage() {
  const [items, setItems] = useState<PageItem[]>([]);
  const [erps, setErps] = useState<ErpItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ pageId: '', pageName: '', accessToken: '', erpConfigId: '' });

  async function load() {
    const [pR, eR] = await Promise.all([fetch('/api/admin/pages'), fetch('/api/admin/erp')]);
    const pD = await pR.json(); const eD = await eR.json();
    setItems(pD.items || []); setErps(eD.items || []);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    const r = await fetch('/api/admin/pages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, erpConfigId: form.erpConfigId || null }),
    });
    if (r.ok) { toast.success('Пэйж нэмэгдлээ'); setCreating(false); setForm({ pageId: '', pageName: '', accessToken: '', erpConfigId: '' }); load(); }
    else toast.error('Алдаа');
  }

  async function update(id: string, data: any) {
    await fetch(`/api/admin/pages/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    load();
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Facebook пэйж</h1>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Пэйж нэмэх
        </button>
      </div>

      {creating && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 space-y-3">
          <Input label="Page ID" value={form.pageId} onChange={(v) => setForm({ ...form, pageId: v })} />
          <Input label="Нэр" value={form.pageName} onChange={(v) => setForm({ ...form, pageName: v })} />
          <Input label="Access Token" value={form.accessToken} onChange={(v) => setForm({ ...form, accessToken: v })} />
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">ERP</label>
            <select value={form.erpConfigId} onChange={(e) => setForm({ ...form, erpConfigId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">(Сонгоогүй)</option>
              {erps.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={create} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm">Хадгалах</button>
            <button onClick={() => setCreating(false)} className="px-4 py-2 text-sm text-slate-600">Болих</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-200">
        {items.map((p) => (
          <div key={p.id} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-medium text-slate-900">{p.pageName}</div>
                <div className="text-xs text-slate-500">ID: {p.pageId}</div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded ${p.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                {p.isActive ? 'Идэвхтэй' : 'Идэвхгүй'}
              </span>
            </div>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div>
                <label className="block text-xs text-slate-600 mb-1">ERP</label>
                <select value={p.erpConfigId ?? ''} onChange={(e) => update(p.id, { erpConfigId: e.target.value || null })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="">(Сонгоогүй)</option>
                  {erps.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Цагт хариу хязгаар</label>
                <input type="number" defaultValue={p.hourlyCommentLimit} onBlur={(e) => update(p.id, { hourlyCommentLimit: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm" />
              </div>
            </div>
            <div className="flex gap-4 mt-3">
              <Toggle label="Идэвхтэй" value={p.isActive} onChange={(v) => update(p.id, { isActive: v })} />
              <Toggle label="Автомат хариу" value={p.autoReplyEnabled} onChange={(v) => update(p.id, { autoReplyEnabled: v })} />
              <Toggle label="Reaction" value={p.reactionEnabled} onChange={(v) => update(p.id, { reactionEnabled: v })} />
            </div>
          </div>
        ))}
        {!items.length && <div className="p-8 text-center text-slate-500 text-sm">Пэйж байхгүй байна</div>}
      </div>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
    </div>
  );
}
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
