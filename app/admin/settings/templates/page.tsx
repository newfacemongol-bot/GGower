'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface Template {
  id: string;
  title: string;
  text: string;
  shortcut: string | null;
  useCount: number;
  isActive: boolean;
}

export default function TemplatesPage() {
  const [items, setItems] = useState<Template[]>([]);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [shortcut, setShortcut] = useState('');
  const [loading, setLoading] = useState(false);

  const load = () => fetch('/api/admin/templates').then((r) => r.json()).then((d) => setItems(d.templates ?? []));
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!title.trim() || !text.trim()) {
      toast.error('Гарчиг болон текст оруулна уу');
      return;
    }
    setLoading(true);
    const r = await fetch('/api/admin/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, text, shortcut: shortcut || undefined }),
    });
    setLoading(false);
    if (r.ok) {
      toast.success('Template нэмэгдлээ');
      setTitle(''); setText(''); setShortcut('');
      load();
    } else {
      toast.error('Алдаа гарлаа');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Устгах уу?')) return;
    await fetch(`/api/admin/templates/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
        <FileText className="w-6 h-6" /> Бэлэн хариу (Template)
      </h1>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="font-semibold text-slate-900 mb-3">Шинэ template</h2>
        <div className="grid md:grid-cols-2 gap-3 mb-3">
          <input
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Гарчиг (ж: Хүргэлтийн хариу)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Товчлол (ж: /del)"
            value={shortcut}
            onChange={(e) => setShortcut(e.target.value)}
          />
        </div>
        <textarea
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3 min-h-[100px]"
          placeholder="Хариултын текст..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          onClick={create}
          disabled={loading}
          className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Нэмэх
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-200">
        {items.length === 0 && (
          <div className="p-8 text-center text-slate-500 text-sm">Template байхгүй байна</div>
        )}
        {items.map((t) => (
          <div key={t.id} className="p-4 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-slate-900">{t.title}</span>
                {t.shortcut && (
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">{t.shortcut}</span>
                )}
                <span className="text-xs text-slate-400">хэрэглэсэн: {t.useCount}</span>
              </div>
              <p className="text-sm text-slate-600 whitespace-pre-wrap break-words">{t.text}</p>
            </div>
            <button
              onClick={() => remove(t.id)}
              className="text-rose-600 hover:bg-rose-50 p-2 rounded-lg"
              aria-label="Устгах"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
