'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, CircleCheck as CheckCircle2, Circle as XCircle, Trash2 } from 'lucide-react';

interface ErpItem {
  id: string; name: string; apiUrl: string; apiKey: string;
  description?: string | null; isActive: boolean;
}

export default function ErpPage() {
  const [items, setItems] = useState<ErpItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', apiUrl: '', apiKey: '', description: '' });

  async function load() {
    const r = await fetch('/api/admin/erp');
    const d = await r.json();
    setItems(d.items || []);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    const r = await fetch('/api/admin/erp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    if (r.ok) { toast.success('ERP нэмэгдлээ / ERP added'); setCreating(false); setForm({ name: '', apiUrl: '', apiKey: '', description: '' }); load(); }
    else toast.error('Алдаа гарлаа / Error');
  }

  async function toggle(id: string, isActive: boolean) {
    await fetch(`/api/admin/erp/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive }) });
    load();
  }

  async function testConn(id: string) {
    const r = await fetch(`/api/admin/erp/${id}?action=test`, { method: 'POST' });
    const d = await r.json();
    if (d.ok) toast.success('Холболт ажиллаж байна / Connection OK');
    else toast.error(`Холболтгүй / No connection: ${d.error}`);
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">ERP тохиргоо / ERP settings</h1>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800">
          <Plus className="w-4 h-4" /> ERP нэмэх / Add ERP
        </button>
      </div>

      {creating && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 space-y-3">
          <Input label="Нэр / Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Input label="API URL" value={form.apiUrl} onChange={(v) => setForm({ ...form, apiUrl: v })} placeholder="https://erp1.mn" />
          <Input label="API Key" value={form.apiKey} onChange={(v) => setForm({ ...form, apiKey: v })} />
          <Input label="Тайлбар / Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          <div className="flex gap-2 pt-2">
            <button onClick={create} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm">Хадгалах / Save</button>
            <button onClick={() => setCreating(false)} className="px-4 py-2 text-sm text-slate-600">Болих / Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-200">
        {items.map((it) => (
          <div key={it.id} className="p-5 flex items-center justify-between">
            <div>
              <div className="font-medium text-slate-900">{it.name}</div>
              <div className="text-xs text-slate-500 mt-0.5">{it.apiUrl}</div>
              {it.description && <div className="text-sm text-slate-600 mt-1">{it.description}</div>}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => testConn(it.id)} className="text-sm text-slate-700 hover:text-slate-900 px-3 py-1.5 border border-slate-300 rounded-lg">
                Холболт шалгах / Test connection
              </button>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={it.isActive} onChange={(e) => toggle(it.id, e.target.checked)} />
                Идэвхтэй / Active
              </label>
            </div>
          </div>
        ))}
        {!items.length && <div className="p-8 text-center text-slate-500 text-sm">ERP байхгүй байна / No ERP configured</div>}
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
    </div>
  );
}
