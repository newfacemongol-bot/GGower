'use client';

import { useEffect, useState } from 'react';
import { Save, RotateCcw, MessageSquare } from 'lucide-react';

interface MessageItem {
  key: string;
  label: string;
  value: string;
  defaultValue: string;
}

export default function BotMessagesPage() {
  const [items, setItems] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});

  async function load() {
    setLoading(true);
    const r = await fetch('/api/admin/messages');
    const d = await r.json();
    setItems(d.items || []);
    setDirty({});
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function onChange(key: string, value: string) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, value } : i)));
    setDirty((d) => ({ ...d, [key]: true }));
    setSaved(false);
  }

  function resetDefault(key: string) {
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, value: i.defaultValue } : i))
    );
    setDirty((d) => ({ ...d, [key]: true }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    const payload = items
      .filter((i) => dirty[i.key])
      .map((i) => ({ key: i.key, value: i.value }));
    if (payload.length === 0) {
      setSaving(false);
      return;
    }
    await fetch('/api/admin/messages', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: payload }),
    });
    setSaving(false);
    setSaved(true);
    setDirty({});
    setTimeout(() => setSaved(false), 2500);
  }

  const hasDirty = Object.values(dirty).some(Boolean);

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-6 h-6" /> Бот мессежүүд / Bot messages
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Ботын бүх хариултын текстийг эндээс засна. Өөрчлөлт 60 секундийн дотор хүчин төгөлдөр болно.
            <br />
            Edit all bot reply texts here. Changes take effect within 60 seconds.
          </p>
        </div>
        <button
          onClick={save}
          disabled={!hasDirty || saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:bg-slate-300 text-sm"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Хадгалж байна... / Saving...' : 'Хадгалах / Save'}
        </button>
      </div>

      {saved && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 rounded-lg text-sm">
          Амжилттай хадгалагдлаа. / Saved successfully.
        </div>
      )}

      {loading ? (
        <div className="text-center text-slate-500 py-16">Ачаалж байна... / Loading...</div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.key} className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-semibold text-slate-900">{item.label}</div>
                  <div className="text-xs text-slate-400 font-mono">{item.key}</div>
                </div>
                <button
                  onClick={() => resetDefault(item.key)}
                  className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
                  title="Анхны утга руу буцаах / Reset to default"
                >
                  <RotateCcw className="w-3 h-3" /> Анхны утга / Default
                </button>
              </div>
              <textarea
                value={item.value}
                onChange={(e) => onChange(item.key, e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              {dirty[item.key] && (
                <div className="text-xs text-amber-600 mt-1">Хадгалаагүй өөрчлөлт / Unsaved changes</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
