'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Bot, User, LogOut, FileText, StickyNote, RotateCcw, ShieldAlert, Phone, X, EyeOff, Eye, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Template { id: string; title: string; text: string; shortcut: string | null; }

interface ConvItem {
  id: string; senderName?: string | null; pageName?: string;
  state: string; isOperatorHandoff: boolean; unreadCount: number;
  lastMessageAt: string; lastMessage?: string; status: string;
  sentiment?: string;
  isSpam?: boolean;
  misunderstandCount?: number;
  hasPhone?: boolean;
  hasAddress?: boolean;
  hasProduct?: boolean;
  phone?: string | null;
  address?: string | null;
  productName?: string | null;
  order?: {
    id: string;
    erpOrderId?: string | null;
    erpOrderNumber?: string | null;
    createdAt?: string;
    address?: string;
    phone?: string;
    productName?: string | null;
  } | null;
}

type TabKey = 'all' | 'ordered' | 'addr_missing' | 'phone_missing' | 'waiting' | 'handoff' | 'calls';

const TAB_META: { key: TabKey; label: string; color: string; dot: string }[] = [
  { key: 'all', label: 'Бүгд', color: 'text-slate-700 border-slate-700', dot: 'bg-slate-400' },
  { key: 'ordered', label: 'Захиалга үүссэн', color: 'text-emerald-700 border-emerald-600', dot: 'bg-emerald-500' },
  { key: 'addr_missing', label: 'Хаяг дутуу', color: 'text-amber-700 border-amber-500', dot: 'bg-amber-400' },
  { key: 'phone_missing', label: 'Утас дутуу', color: 'text-blue-700 border-blue-500', dot: 'bg-blue-500' },
  { key: 'waiting', label: 'Хариу хүлээж', color: 'text-red-700 border-red-500', dot: 'bg-red-500' },
  { key: 'handoff', label: 'Оператортой холбогдох', color: 'text-fuchsia-700 border-fuchsia-500', dot: 'bg-fuchsia-500' },
  { key: 'calls', label: 'Залгах жагсаалт', color: 'text-teal-700 border-teal-500', dot: 'bg-teal-500' },
];

function isToday(d: string | Date): boolean {
  const x = new Date(d);
  const n = new Date();
  return x.getFullYear() === n.getFullYear() && x.getMonth() === n.getMonth() && x.getDate() === n.getDate();
}

function minutesSince(d: string | Date): number {
  return Math.floor((Date.now() - new Date(d).getTime()) / 60000);
}

function relativeTime(d: string | Date): string {
  const m = minutesSince(d);
  if (m < 1) return 'дөнгөж сая';
  if (m < 60) return `${m} мин өмнө`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} цаг өмнө`;
  return `${Math.floor(h / 24)} өдөр өмнө`;
}

function isSilent(c: ConvItem): boolean {
  if (!c.lastMessageAt) return false;
  if (c.state === 'IDLE' || c.state === 'DONE') return false;
  return minutesSince(c.lastMessageAt) >= 30;
}

function isUrgentFlag(c: ConvItem): boolean {
  return c.isOperatorHandoff || (c.misunderstandCount ?? 0) >= 2 || c.sentiment === 'complaint' || c.sentiment === 'urgent';
}

function classifyConv(c: ConvItem): TabKey[] {
  const tabs: TabKey[] = ['all'];
  if (c.order?.erpOrderId) tabs.push('ordered');
  if (c.hasPhone && !c.hasAddress) tabs.push('addr_missing');
  if (c.hasAddress && !c.hasPhone) tabs.push('phone_missing');
  if (isSilent(c)) tabs.push('waiting');
  if (isUrgentFlag(c)) tabs.push('handoff');
  if (c.hasPhone && !c.hasAddress && c.lastMessageAt && minutesSince(c.lastMessageAt) >= 60) tabs.push('calls');
  return tabs;
}

function missingBadges(c: ConvItem): { cls: string; text: string }[] {
  const badges: { cls: string; text: string }[] = [];
  if (isUrgentFlag(c)) badges.push({ cls: 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-300', text: 'Оператор шаардлагатай' });
  if (isSilent(c)) badges.push({ cls: 'bg-red-100 text-red-800 border border-red-300', text: 'Хариу байхгүй' });
  if (c.hasPhone && !c.hasAddress) badges.push({ cls: 'bg-amber-100 text-amber-800 border border-amber-300', text: 'Хаяг дутуу' });
  if (c.hasAddress && !c.hasPhone) badges.push({ cls: 'bg-blue-100 text-blue-800 border border-blue-300', text: 'Утас дутуу' });
  if (!c.hasProduct && c.state !== 'IDLE' && c.state !== 'DONE') badges.push({ cls: 'bg-orange-100 text-orange-800 border border-orange-300', text: 'Бараа дутуу' });
  return badges;
}

function convDotColor(c: ConvItem): string {
  if (isUrgentFlag(c)) return 'bg-fuchsia-500';
  if (isSilent(c)) return 'bg-red-500';
  if (c.order?.erpOrderId) return 'bg-emerald-500';
  if (c.hasPhone && !c.hasAddress) return 'bg-amber-400';
  if (c.hasAddress && !c.hasPhone) return 'bg-blue-500';
  return 'bg-slate-300';
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
  const [phonesTab, setPhonesTab] = useState<'phones' | 'hidden'>('phones');
  const [phones, setPhones] = useState<any[]>([]);
  const [hidden, setHidden] = useState<any[]>([]);
  const [phonesLoading, setPhonesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [lastRefreshAt, setLastRefreshAt] = useState<number>(Date.now());
  const [now, setNow] = useState<number>(Date.now());
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
    setLastRefreshAt(Date.now());
  }

  async function loadConv(id: string) {
    const r = await fetch(`/api/operator/conversations/${id}`);
    const d = await r.json();
    setConv(d.conversation);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  useEffect(() => {
    loadList();
    const id = setInterval(loadList, 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
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
      const [a, b] = await Promise.all([
        fetch('/api/operator/comment-phones?hours=16').then((r) => r.json()),
        fetch('/api/operator/hidden-comments').then((r) => r.json()),
      ]);
      setPhones(a.items || []);
      setHidden(b.items || []);
    } finally {
      setPhonesLoading(false);
    }
  }

  async function unhideComment(id: string) {
    await fetch(`/api/operator/hidden-comments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unhide' }),
    });
    loadPhones();
  }

  async function deleteHiddenComment(id: string) {
    if (!confirm('Энэ коммэнтийг устгах уу?')) return;
    await fetch(`/api/operator/hidden-comments/${id}`, { method: 'DELETE' });
    loadPhones();
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  return (
    <div className="h-screen flex bg-slate-50">
      <aside className="w-96 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Чат удирдлага</h2>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Сүүлд шинэчлэгдсэн: {Math.max(0, Math.floor((now - lastRefreshAt) / 1000))} сек өмнө
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowPhones(true); loadPhones(); }}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
              title="Комментоос цуглуулсан"
            >
              <Phone className="w-3 h-3" /> Утас
            </button>
            <button onClick={logout} className="text-slate-500 hover:text-slate-900"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="border-b border-slate-200">
          <div className="flex flex-wrap gap-1 px-2 py-2">
            {TAB_META.map((t) => {
              const counts = list.filter((c) => classifyConv(c).includes(t.key));
              const count = t.key === 'ordered'
                ? counts.filter((c) => c.order?.createdAt && isToday(c.order.createdAt)).length
                : counts.length;
              const active = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md whitespace-nowrap transition ${active ? `bg-slate-100 font-semibold ${t.color.split(' ')[0]}` : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <span className={`w-2 h-2 rounded-full ${t.dot}`}></span>
                  <span>{t.label}</span>
                  <span className="bg-slate-200 text-slate-700 rounded-full px-1.5 text-[10px] font-semibold">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex-1 overflow-auto divide-y divide-slate-100">
          {(() => {
            let filtered = list.filter((c) => classifyConv(c).includes(activeTab));
            if (activeTab === 'calls') {
              filtered.sort((a, b) => new Date(a.lastMessageAt).getTime() - new Date(b.lastMessageAt).getTime());
            } else {
              filtered.sort((a, b) => {
                const ua = isUrgentFlag(a) ? 0 : 1;
                const ub = isUrgentFlag(b) ? 0 : 1;
                if (ua !== ub) return ua - ub;
                return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
              });
            }

            if (filtered.length === 0) {
              return <div className="p-8 text-center text-slate-500 text-sm">Чат байхгүй</div>;
            }

            return filtered.map((c) => {
              const badges = missingBadges(c);
              const isCallTab = activeTab === 'calls';
              const isOrderedTab = activeTab === 'ordered';
              return (
                <div
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 cursor-pointer ${activeId === c.id ? 'bg-slate-100' : ''}`}
                >
                  <div className="flex items-center justify-between mb-0.5 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${convDotColor(c)}`}></span>
                      <span className="font-medium text-slate-900 text-sm truncate">{c.senderName || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {c.unreadCount > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">{c.unreadCount}</span>}
                    </div>
                  </div>
                  {c.phone && (
                    <div className={`${isCallTab ? 'text-base font-mono font-bold text-slate-900' : 'text-xs font-mono text-slate-700'}`}>
                      {c.phone}
                    </div>
                  )}
                  <div className="text-xs text-slate-500 truncate">
                    {(c.lastMessage || '—').slice(0, 40)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{relativeTime(c.lastMessageAt)}</div>

                  {isOrderedTab && c.order && (
                    <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1.5 text-xs space-y-0.5">
                      <div className="font-semibold text-emerald-800">
                        Захиалга #{c.order.erpOrderNumber || c.order.erpOrderId}
                      </div>
                      {c.order.productName && <div className="text-emerald-900 truncate">{c.order.productName}</div>}
                      {c.order.address && <div className="text-emerald-700 truncate">{c.order.address}</div>}
                    </div>
                  )}

                  {!isOrderedTab && (
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {badges.map((b, i) => (
                        <span key={i} className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded font-medium ${b.cls}`}>
                          {b.text}
                        </span>
                      ))}
                      {c.isSpam && (
                        <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium text-[10px]">
                          <ShieldAlert className="w-3 h-3" /> Spam
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {isCallTab && c.phone && (
                      <a
                        href={`tel:${c.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-teal-600 text-white rounded hover:bg-teal-700"
                      >
                        <Phone className="w-3 h-3" /> Дуудах
                      </a>
                    )}
                    {isOrderedTab && c.order?.erpOrderId && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-emerald-300 text-emerald-700 rounded">
                        <FileText className="w-3 h-3" /> ERP #{c.order.erpOrderNumber || c.order.erpOrderId}
                      </span>
                    )}
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
                      >
                        Буцаах
                      </button>
                    )}
                  </div>
                </div>
              );
            });
          })()}
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
              <h3 className="font-bold text-slate-900">Коммент удирдлага</h3>
              <button onClick={() => setShowPhones(false)} className="text-slate-500 hover:text-slate-900"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 pt-3 border-b border-slate-200 flex gap-1">
              <button
                onClick={() => setPhonesTab('phones')}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${phonesTab === 'phones' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
              >
                <span className="inline-flex items-center gap-1"><Phone className="w-4 h-4" /> Цуглуулсан утаснууд ({phones.length})</span>
              </button>
              <button
                onClick={() => setPhonesTab('hidden')}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${phonesTab === 'hidden' ? 'border-red-600 text-red-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
              >
                <span className="inline-flex items-center gap-1"><EyeOff className="w-4 h-4" /> Нуугдсан коммент ({hidden.length})</span>
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              {phonesLoading && <div className="p-8 text-center text-slate-500 text-sm">Ачааллаж байна...</div>}
              {!phonesLoading && phonesTab === 'phones' && (
                <>
                  {phones.length === 0 && <div className="p-8 text-center text-slate-500 text-sm">Утас олдсонгүй</div>}
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
                </>
              )}
              {!phonesLoading && phonesTab === 'hidden' && (
                <>
                  {hidden.length === 0 && <div className="p-8 text-center text-slate-500 text-sm">Нуугдсан коммент байхгүй</div>}
                  <div className="divide-y divide-slate-100">
                    {hidden.map((h) => (
                      <div key={h.id} className="px-6 py-3 hover:bg-slate-50">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-slate-900">{h.senderName || 'Unknown'}</span>
                              <span className="text-xs text-slate-500">{h.pageName}</span>
                              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">NEGATIVE</span>
                            </div>
                            <div className="text-sm text-slate-700 mb-1 whitespace-pre-wrap">{h.commentText}</div>
                            {h.postLink && (
                              <a href={h.postLink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                                Постыг харах
                              </a>
                            )}
                          </div>
                          <div className="shrink-0 flex flex-col gap-1">
                            <button
                              onClick={() => unhideComment(h.id)}
                              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100"
                            >
                              <Eye className="w-3 h-3" /> Харуулах
                            </button>
                            <button
                              onClick={() => deleteHiddenComment(h.id)}
                              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                              <Trash2 className="w-3 h-3" /> Устгах
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
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
