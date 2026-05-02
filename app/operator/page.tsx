'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Bot, User, LogOut, FileText, StickyNote, RotateCcw, ShieldAlert, Phone, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Template { id: string; title: string; text: string; shortcut: string | null; }

interface ConvItem {
  id: string; senderName?: string | null; pageName?: string;
  state: string; isOperatorHandoff: boolean; unreadCount: number;
  lastMessageAt: string; lastMessage?: string; status: string;
  sentiment?: string;
  isSpam?: boolean;
}

export default function OperatorPage() {
  const [list, setList] = useState<ConvItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [conv, setConv] = useState<any>(null);
  const [text, setText] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [editingNote, setEditingNote] = useState(false);
  const [showPhones, setShowPhones] = useState(false);
  const [phones, setPhones] = useState<any[]>([]);
  const [phonesLoading, setPhonesLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/admin/templates').then((r) => r.json()).then((d) => setTemplates(d.templates ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (conv) {
      setNoteDraft(conv.handoffReason ?? '');
      setEditingNote(false);
    }
  }, [conv?.id]);

  const knownUrgentRef = useRef<Set<string>>(new Set());
  async function loadList() {
    const r = await fetch('/api/operator/conversations');
    const d = await r.json();
    const items: ConvItem[] = d.items || [];
    const currentUrgent = new Set(items.filter((i) => i.sentiment === 'urgent').map((i) => i.id));
    for (const id of currentUrgent) {
      if (!knownUrgentRef.current.has(id)) {
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.frequency.value = 880;
          g.gain.value = 0.08;
          o.start();
          setTimeout(() => { o.stop(); ctx.close(); }, 300);
        } catch {}
        break;
      }
    }
    knownUrgentRef.current = currentUrgent;
    setList(items);
  }

  async function loadConv(id: string) {
    const r = await fetch(`/api/operator/conversations/${id}`);
    const d = await r.json();
    setConv(d.conversation);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  useEffect(() => {
    loadList();
    const id = setInterval(loadList, 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!activeId) return;
    loadConv(activeId);
    const id = setInterval(() => loadConv(activeId), 3000);
    return () => clearInterval(id);
  }, [activeId]);

  async function send() {
    if (!text.trim() || !activeId) return;
    const msg = text; setText('');
    await fetch(`/api/operator/conversations/${activeId}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: msg }),
    });
    loadConv(activeId);
  }

  function applyTemplate(t: Template) {
    setText(t.text);
    setShowTemplates(false);
    fetch(`/api/admin/templates/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ incrementUse: true }),
    }).catch(() => {});
  }

  async function saveNote() {
    if (!conv) return;
    await fetch(`/api/operator/conversations/${conv.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handoffReason: noteDraft }),
    });
    setEditingNote(false);
    loadConv(conv.id);
  }

  async function toggleHandoff() {
    if (!conv) return;
    await fetch(`/api/operator/conversations/${conv.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isOperatorHandoff: !conv.isOperatorHandoff }),
    });
    loadConv(conv.id);
  }
  async function close() {
    if (!conv) return;
    await fetch(`/api/operator/conversations/${conv.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'closed' }),
    });
    loadConv(conv.id);
  }

  async function resetConv(id: string, e?: React.MouseEvent) {
    e?.stopPropagation();
    if (!confirm('Энэ харилцан яриаг дахин эхлүүлэх үү?')) return;
    await fetch(`/api/operator/conversations/${id}/reset`, { method: 'POST' });
    loadList();
    if (activeId === id) loadConv(id);
  }

  async function unspam(id: string, e?: React.MouseEvent) {
    e?.stopPropagation();
    await fetch(`/api/operator/conversations/${id}/unspam`, { method: 'POST' });
    loadList();
    if (activeId === id) loadConv(id);
  }

  async function loadPhones() {
    setPhonesLoading(true);
    try {
      const r = await fetch('/api/operator/comment-phones?hours=16');
      const d = await r.json();
      setPhones(d.items || []);
    } finally {
      setPhonesLoading(false);
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  return (
    <div className="h-screen flex bg-slate-50">
      <aside className="w-80 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Чат</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowPhones(true); loadPhones(); }}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
              title="Шөнийн утаснууд"
            >
              <Phone className="w-3 h-3" /> Утас
            </button>
            <button onClick={logout} className="text-slate-500 hover:text-slate-900"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-auto divide-y divide-slate-100">
          {list.map((c) => (
            <div
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`w-full text-left px-4 py-3 hover:bg-slate-50 cursor-pointer ${activeId === c.id ? 'bg-slate-100' : ''}`}
            >
              <div className="flex items-center justify-between mb-0.5 gap-2">
                <span className="font-medium text-slate-900 text-sm truncate">{c.senderName || 'Unknown'}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {c.unreadCount > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">{c.unreadCount}</span>}
                </div>
              </div>
              <div className="text-xs text-slate-500 truncate">{c.lastMessage || '—'}</div>
              <div className="flex items-center gap-2 mt-1 text-xs flex-wrap">
                <span className="text-slate-400">{c.pageName}</span>
                <StatusIcon status={c.status} handoff={c.isOperatorHandoff} />
                {c.sentiment === 'urgent' && (
                  <span className="inline-flex items-center gap-1 bg-red-600 text-white px-1.5 py-0.5 rounded font-semibold animate-pulse">
                    URGENT
                  </span>
                )}
                {c.sentiment === 'complaint' && (
                  <span className="inline-flex items-center gap-1 bg-orange-500 text-white px-1.5 py-0.5 rounded font-semibold">
                    COMPLAINT
                  </span>
                )}
                {c.isSpam && (
                  <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">
                    <ShieldAlert className="w-3 h-3" /> Spam
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={(e) => resetConv(c.id, e)}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-slate-300 rounded hover:bg-slate-100 text-slate-700"
                  title="Харилцан яриаг дахин эхлүүлэх"
                >
                  <RotateCcw className="w-3 h-3" /> Дахин эхлэх
                </button>
                {c.isSpam && (
                  <button
                    onClick={(e) => unspam(c.id, e)}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-red-300 text-red-700 rounded hover:bg-red-50"
                    title="Spam блокийг буцаах"
                  >
                    Буцаах
                  </button>
                )}
              </div>
            </div>
          ))}
          {!list.length && <div className="p-8 text-center text-slate-500 text-sm">Чат байхгүй</div>}
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        {!conv && <div className="flex-1 flex items-center justify-center text-slate-500">Чат сонгоно уу</div>}
        {conv && (
          <>
            <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-900">{conv.senderName || 'Unknown'}</div>
                <div className="text-xs text-slate-500">{conv.page?.pageName} · State: {conv.state}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={toggleHandoff} className="text-sm px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50">
                  {conv.isOperatorHandoff ? 'Bot-д шилжүүлэх' : 'Оператор авах'}
                </button>
                <button onClick={close} className="text-sm px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50">
                  Дуусгах
                </button>
              </div>
            </header>
            <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center gap-2 text-sm">
              <StickyNote className="w-4 h-4 text-amber-700 shrink-0" />
              {editingNote ? (
                <>
                  <input
                    className="flex-1 bg-white border border-amber-300 rounded px-2 py-1 text-sm"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Тэмдэглэл... (ж: үнэ эргэлзэлтэй)"
                    autoFocus
                  />
                  <button onClick={saveNote} className="text-sm px-2 py-1 bg-amber-600 text-white rounded">Хадгалах</button>
                  <button onClick={() => { setEditingNote(false); setNoteDraft(conv.handoffReason ?? ''); }} className="text-sm px-2 py-1 text-slate-600">Болих</button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-amber-900 truncate">
                    {conv.handoffReason ? conv.handoffReason : <span className="text-amber-700/60 italic">Тэмдэглэл байхгүй</span>}
                  </span>
                  <button onClick={() => setEditingNote(true)} className="text-xs text-amber-700 hover:underline">
                    Засах
                  </button>
                </>
              )}
            </div>
            <div className="flex-1 overflow-auto p-6 space-y-3">
              {conv.messages.map((m: any) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              <div ref={endRef} />
            </div>
            <footer className="bg-white border-t border-slate-200 p-4 relative">
              {showTemplates && (
                <div className="absolute bottom-full left-4 right-4 mb-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-72 overflow-auto">
                  {templates.length === 0 && (
                    <div className="p-4 text-sm text-slate-500 text-center">Template байхгүй байна</div>
                  )}
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => applyTemplate(t)}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-slate-900 text-sm">{t.title}</span>
                        {t.shortcut && (
                          <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">{t.shortcut}</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 line-clamp-2">{t.text}</div>
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowTemplates((v) => !v)}
                  className="px-3 border border-slate-300 rounded-lg hover:bg-slate-50"
                  title="Template"
                >
                  <FileText className="w-4 h-4" />
                </button>
                <input value={text} onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && send()}
                  placeholder="Мессеж бичих..." className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900" />
                <button onClick={send} className="bg-slate-900 text-white px-4 rounded-lg hover:bg-slate-800">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </footer>
          </>
        )}
      </main>

      {showPhones && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={() => setShowPhones(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Phone className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-900">Комментоос цуглуулсан утас</h3>
                </div>
                <div className="text-sm text-slate-600 mt-1">
                  Сүүлийн 16 цагт <b>{phones.length}</b> утас цуглуулсан
                </div>
              </div>
              <button onClick={() => setShowPhones(false)} className="text-slate-500 hover:text-slate-900"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-auto">
              {phonesLoading && <div className="p-8 text-center text-slate-500 text-sm">Ачааллаж байна...</div>}
              {!phonesLoading && phones.length === 0 && (
                <div className="p-8 text-center text-slate-500 text-sm">Утас олдсонгүй</div>
              )}
              <div className="divide-y divide-slate-100">
                {phones.map((p) => (
                  <div key={p.id} className="px-6 py-3 hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-slate-900">{p.senderName || 'Unknown'}</span>
                          <span className="text-xs text-slate-500">{p.pageName}</span>
                        </div>
                        <div className="text-sm text-slate-700 line-clamp-2 mb-1">{p.commentText}</div>
                        {p.postLink && (
                          <a href={p.postLink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                            Постыг харах
                          </a>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-mono font-bold text-slate-900 mb-1">{p.phone}</div>
                        <a
                          href={`tel:${p.phone}`}
                          className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                        >
                          <Phone className="w-3 h-3" /> Дуудах
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: any }) {
  const fromBot = message.isFromBot && !message.isFromOperator;
  const fromOp = message.isFromOperator;
  const fromUser = !fromBot && !fromOp;
  return (
    <div className={`flex ${fromUser ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${
        fromUser ? 'bg-white border border-slate-200 text-slate-900' :
        fromOp ? 'bg-slate-900 text-white' :
        'bg-blue-100 text-slate-900'
      }`}>
        <div className="flex items-center gap-1.5 text-xs opacity-70 mb-0.5">
          {fromBot ? <><Bot className="w-3 h-3" /> Bot</> : fromOp ? <><User className="w-3 h-3" /> Оператор</> : null}
        </div>
        <div className="whitespace-pre-wrap">{message.text}</div>
      </div>
    </div>
  );
}

function StatusIcon({ status, handoff }: { status: string; handoff: boolean }) {
  if (status === 'closed') return <span className="text-slate-500">Дууссан</span>;
  if (handoff) return <span className="text-amber-600">Оператор</span>;
  return <span className="text-emerald-600">Bot</span>;
}
