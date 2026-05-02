'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [replies, setReplies] = useState<{ id: string; text: string; isActive: boolean }[]>([]);
  const [newReply, setNewReply] = useState('');

  async function load() {
    const [s, r] = await Promise.all([fetch('/api/admin/settings'), fetch('/api/admin/replies')]);
    const sd = await s.json(); const rd = await r.json();
    setSettings(sd.settings || {});
    setReplies(rd.items || []);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    const r = await fetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }) });
    if (r.ok) toast.success('Хадгалагдлаа / Saved'); else toast.error('Алдаа / Error');
  }

  async function addReply() {
    if (!newReply.trim()) return;
    const r = await fetch('/api/admin/replies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: newReply }) });
    if (r.ok) { setNewReply(''); load(); }
  }
  async function deleteReply(id: string) {
    await fetch(`/api/admin/replies/${id}`, { method: 'DELETE' });
    load();
  }
  async function updateReply(id: string, data: any) {
    await fetch(`/api/admin/replies/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    load();
  }

  const s = settings;
  const set = (k: string, v: string) => setSettings({ ...settings, [k]: v });

  return (
    <div className="p-8 max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Ерөнхий тохиргоо / General settings</h1>
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <Row label="Bot идэвхтэй / Bot enabled">
            <Select value={s.bot_enabled ?? 'true'} onChange={(v) => set('bot_enabled', v)} options={[['true','Тийм / Yes'],['false','Үгүй / No']]} />
          </Row>
          <Row label="Шөнийн горим / Night mode">
            <Select value={s.night_mode_enabled ?? 'true'} onChange={(v) => set('night_mode_enabled', v)} options={[['true','Тийм / Yes'],['false','Үгүй / No']]} />
          </Row>
          <Row label="Шөнийн горим эхлэх цаг / Night start hour">
            <NumInput value={s.night_start_hour ?? '22'} onChange={(v) => set('night_start_hour', v)} />
          </Row>
          <Row label="Шөнийн горим дуусах цаг / Night end hour">
            <NumInput value={s.night_end_hour ?? '8'} onChange={(v) => set('night_end_hour', v)} />
          </Row>
          <Row label="Reaction">
            <Select value={s.reaction_enabled ?? 'false'} onChange={(v) => set('reaction_enabled', v)} options={[['true','Тийм / Yes'],['false','Үгүй / No']]} />
          </Row>
          <Row label="Цагт хариу хязгаар / Hourly reply limit (default)">
            <NumInput value={s.hourly_comment_limit ?? '60'} onChange={(v) => set('hourly_comment_limit', v)} />
          </Row>
          <Row label="Хүргэлт эхлэх цаг / Delivery start hour">
            <NumInput value={s.delivery_start_hour ?? '8'} onChange={(v) => set('delivery_start_hour', v)} />
          </Row>
          <Row label="Хүргэлт дуусах цаг / Delivery end hour">
            <NumInput value={s.delivery_end_hour ?? '16'} onChange={(v) => set('delivery_end_hour', v)} />
          </Row>
          <button onClick={save} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm">Хадгалах / Save</button>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Автомат хариу хувилбарууд / Auto-reply variants</h2>
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-200">
          {replies.map((r) => (
            <div key={r.id} className="p-4 flex items-start gap-3">
              <textarea defaultValue={r.text} onBlur={(e) => updateReply(r.id, { text: e.target.value })}
                className="flex-1 px-3 py-2 border border-slate-300 rounded text-sm" rows={2} />
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 pt-2">
                <input type="checkbox" checked={r.isActive} onChange={(e) => updateReply(r.id, { isActive: e.target.checked })} />
                Идэвхтэй / Active
              </label>
              <button onClick={() => deleteReply(r.id)} className="p-2 text-slate-500 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <div className="p-4 flex gap-3">
            <textarea value={newReply} onChange={(e) => setNewReply(e.target.value)} placeholder="Шинэ хариу нэмэх / Add new reply... {name} хувьсагч / variable"
              className="flex-1 px-3 py-2 border border-slate-300 rounded text-sm" rows={2} />
            <button onClick={addReply} className="self-start inline-flex items-center gap-1.5 bg-slate-900 text-white px-3 py-2 rounded text-sm">
              <Plus className="w-4 h-4" /> Нэмэх / Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm text-slate-700">{label}</label>
      <div className="w-48">{children}</div>
    </div>
  );
}
function NumInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input type="number" value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm" />;
}
function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
