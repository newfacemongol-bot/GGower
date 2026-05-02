'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Bot, User, LogOut, FileText, StickyNote, RotateCcw, ShieldAlert, Phone, X, EyeOff, Eye, Trash2, MapPin, Package, Hash, Wallet, NotebookPen, Chrome as Home, Globe as Globe2, TriangleAlert as AlertTriangle, Archive, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

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
  { key: 'all', label: 'Бүгд / All', color: 'text-slate-700 border-slate-700', dot: 'bg-slate-400' },
  { key: 'ordered', label: 'Захиалга үүссэн / Orders', color: 'text-emerald-700 border-emerald-600', dot: 'bg-emerald-500' },
  { key: 'addr_missing', label: 'Хаяг дутуу / Missing address', color: 'text-amber-700 border-amber-500', dot: 'bg-amber-400' },
  { key: 'phone_missing', label: 'Утас дутуу / Missing phone', color: 'text-blue-700 border-blue-500', dot: 'bg-blue-500' },
  { key: 'waiting', label: 'Хариу хүлээж / Awaiting reply', color: 'text-red-700 border-red-500', dot: 'bg-red-500' },
  { key: 'handoff', label: 'Оператортой холбогдох / Operator handoff', color: 'text-fuchsia-700 border-fuchsia-500', dot: 'bg-fuchsia-500' },
  { key: 'calls', label: 'Залгах жагсаалт / Call list', color: 'text-teal-700 border-teal-500', dot: 'bg-teal-500' },
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
  if (m < 1) return 'дөнгөж сая / just now';
  if (m < 60) return `${m} мин өмнө / min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} цаг өмнө / hr ago`;
  return `${Math.floor(h / 24)} өдөр өмнө / days ago`;
}

const FB_WINDOW_MS = 24 * 60 * 60 * 1000;

function msLeftInWindow(lastMessageAt: string | Date | null | undefined, nowMs: number = Date.now()): number {
  if (!lastMessageAt) return 0;
  const last = new Date(lastMessageAt).getTime();
  return Math.max(0, FB_WINDOW_MS - (nowMs - last));
}

function fmtCountdown(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function windowTone(ms: number): 'safe' | 'warn' | 'critical' | 'expired' {
  if (ms <= 0) return 'expired';
  if (ms < 30 * 60 * 1000) return 'critical';
  if (ms < 60 * 60 * 1000) return 'warn';
  return 'safe';
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
  if (isUrgentFlag(c)) badges.push({ cls: 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-300', text: 'Оператор шаардлагатай / Operator needed' });
  if (isSilent(c)) badges.push({ cls: 'bg-red-100 text-red-800 border border-red-300', text: 'Хариу байхгүй / No reply' });
  if (c.hasPhone && !c.hasAddress) badges.push({ cls: 'bg-amber-100 text-amber-800 border border-amber-300', text: 'Хаяг дутуу / Missing address' });
  if (c.hasAddress && !c.hasPhone) badges.push({ cls: 'bg-blue-100 text-blue-800 border border-blue-300', text: 'Утас дутуу / Missing phone' });
  if (!c.hasProduct && c.state !== 'IDLE' && c.state !== 'DONE') badges.push({ cls: 'bg-orange-100 text-orange-800 border border-orange-300', text: 'Бараа дутуу / Missing product' });
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
  const [showArchived, setShowArchived] = useState(false);
  const [convPage, setConvPage] = useState(1);
  const [convTotalPages, setConvTotalPages] = useState(1);
  const [convSearch, setConvSearch] = useState('');
  const [convSearchInput, setConvSearchInput] = useState('');
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
    const params = new URLSearchParams();
    params.set('page', String(convPage));
    if (showArchived) params.set('archived', '1');
    if (convSearch) params.set('search', convSearch);
    const r = await fetch(`/api/operator/conversations?${params}`);
    const d = await r.json();
    const items: ConvItem[] = d.items || [];
    if (typeof d.totalPages === 'number') setConvTotalPages(d.totalPages);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convPage, showArchived, convSearch]);

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
    const res = await fetch(`/api/operator/conversations/${activeId}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: msg }),
    });
    if (res.status === 403) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.message || '24 цагийн цонх хэтэрсэн байна. / 24-hour window expired.');
      setText(msg);
      loadConv(activeId);
      return;
    }
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
    if (!confirm('Restart this chat?')) return;
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
    if (!confirm('Энэ коммэнтийг устгах уу? / Delete this comment?')) return;
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
        <div className="px-5 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-slate-900 text-base">Inbox</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setShowArchived(v => !v); setConvPage(1); }}
                className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition ${showArchived ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                title="Архив харах / Show archive"
              >
                <Archive className="w-3 h-3" />
                <span className="hidden xl:inline">{showArchived ? 'Archive' : 'Archive'}</span>
              </button>
              <button
                onClick={() => { setShowPhones(true); loadPhones(); }}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors"
                title="Customer phone numbers"
              >
                <Phone className="w-3 h-3" />
                <span className="hidden xl:inline">Phones</span>
              </button>
              <button onClick={logout} className="p-1 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors" title="Гарах / Log out">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            Live · updated {Math.max(0, Math.floor((now - lastRefreshAt) / 1000))}s ago
          </div>
        </div>
        <div className="px-4 py-3 border-b border-slate-200">
          <form
            onSubmit={(e) => { e.preventDefault(); setConvSearch(convSearchInput.trim()); setConvPage(1); }}
            className="relative"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={convSearchInput}
              onChange={(e) => setConvSearchInput(e.target.value)}
              placeholder="Search name or phone..."
              className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
            />
            {convSearch && (
              <button
                type="button"
                onClick={() => { setConvSearch(''); setConvSearchInput(''); setConvPage(1); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>
        </div>
        <div className="border-b border-slate-200">
          <div className="flex flex-wrap gap-1 px-3 py-2">
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
                  title={t.label}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-full whitespace-nowrap transition-all ${active ? `bg-slate-900 text-white font-semibold shadow-sm` : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`}></span>
                  <span>{t.label}</span>
                  <span className={`rounded-full px-1.5 text-[10px] font-semibold ${active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>{count}</span>
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
              return (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <Bot className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="text-sm font-medium text-slate-600">No chats</div>
                  <div className="text-xs text-slate-400 mt-0.5">Чат байхгүй</div>
                </div>
              );
            }

            return filtered.map((c) => {
              const badges = missingBadges(c);
              const isCallTab = activeTab === 'calls';
              const isOrderedTab = activeTab === 'ordered';
              const initials = (c.senderName || 'U').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
              const isActive = activeId === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={`group relative w-full text-left px-4 py-3 cursor-pointer transition-all ${isActive ? 'bg-emerald-50/60' : 'hover:bg-slate-50'}`}
                >
                  {isActive && <span className="absolute left-0 top-2 bottom-2 w-1 bg-emerald-500 rounded-r-full" />}
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold ${isActive ? 'bg-emerald-500 text-white' : 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600'}`}>
                        {initials}
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${convDotColor(c)}`}></span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="font-semibold text-slate-900 text-sm truncate">{c.senderName || 'Unknown'}</span>
                        <span className="text-[10px] text-slate-400 shrink-0 tabular-nums">{relativeTime(c.lastMessageAt).split(' / ')[0]}</span>
                      </div>
                      {c.phone && (
                        <div className={`${isCallTab ? 'text-sm font-mono font-bold text-slate-900' : 'text-[11px] font-mono text-slate-500'} truncate`}>
                          {c.phone}
                        </div>
                      )}
                      <div className="text-xs text-slate-500 truncate">
                        {(c.lastMessage || '—').slice(0, 50)}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <WindowPill lastMessageAt={c.lastMessageAt} now={now} />
                        {c.unreadCount > 0 && <span className="bg-emerald-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1.5 flex items-center justify-center">{c.unreadCount}</span>}
                      </div>
                    </div>
                  </div>

                  {isOrderedTab && c.order && (
                    <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1.5 text-xs space-y-0.5">
                      <div className="font-semibold text-emerald-800">
                        Захиалга / Order #{c.order.erpOrderNumber || c.order.erpOrderId}
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
                        <Phone className="w-3 h-3" /> Дуудах / Call
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
                      title="Restart Chat"
                    >
                      <RotateCcw className="w-3 h-3" /> Restart Chat
                    </button>
                    {c.isSpam && (
                      <button
                        onClick={(e) => unspam(c.id, e)}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-red-300 text-red-700 rounded hover:bg-red-50"
                      >
                        Буцаах / Unspam
                      </button>
                    )}
                  </div>
                </div>
              );
            });
          })()}
        </div>
        <Pagination
          page={convPage}
          totalPages={convTotalPages}
          onChange={(p) => setConvPage(p)}
        />
      </aside>

      <main className="flex-1 flex">
        {!conv && (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg mb-4">
              <Bot className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Select a conversation</h2>
            <p className="text-sm text-slate-500">Зүүн талаас чат сонгон харилцан яриаг үргэлжлүүлнэ үү</p>
          </div>
        )}
        {conv && (
          <>
            <div className="flex-1 flex flex-col min-w-0" style={{ flexBasis: '70%' }}>
            <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-xs font-semibold shrink-0">
                  {(conv.senderName || 'U').split(' ').map((s: string) => s[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 truncate">{conv.senderName || 'Unknown'}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-1.5 truncate">
                    <span className="truncate">{conv.page?.pageName}</span>
                    <span className="text-slate-300">·</span>
                    <StatusIcon status={conv.status} handoff={conv.isOperatorHandoff} />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={toggleHandoff} className={`text-sm px-3 py-1.5 rounded-lg transition-colors font-medium ${conv.isOperatorHandoff ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                  {conv.isOperatorHandoff ? 'Switch to Bot' : 'Take Over'}
                </button>
                <button onClick={close} className="text-sm px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 font-medium">
                  Close
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
                    placeholder="Тэмдэглэл / Note... (e.g. price hesitation)"
                    autoFocus
                  />
                  <button onClick={saveNote} className="text-sm px-2 py-1 bg-amber-600 text-white rounded">Хадгалах / Save</button>
                  <button onClick={() => { setEditingNote(false); setNoteDraft(conv.handoffReason ?? ''); }} className="text-sm px-2 py-1 text-slate-600">Болих / Cancel</button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-amber-900 truncate">
                    {conv.handoffReason ? conv.handoffReason : <span className="text-amber-700/60 italic">Тэмдэглэл байхгүй / No note</span>}
                  </span>
                  <button onClick={() => setEditingNote(true)} className="text-xs text-amber-700 hover:underline">
                    Засах / Edit
                  </button>
                </>
              )}
            </div>
            <div className="flex-1 overflow-auto p-6 space-y-3 bg-gradient-to-b from-slate-50/50 to-slate-50">
              {conv.messages.map((m: any) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              <div ref={endRef} />
            </div>
            <WindowBanner lastMessageAt={conv.lastMessageAt} now={now} />
            <footer className="bg-white border-t border-slate-200 p-4 relative">
              {showTemplates && (
                <div className="absolute bottom-full left-4 right-4 mb-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-72 overflow-auto">
                  {templates.length === 0 && (
                    <div className="p-4 text-sm text-slate-500 text-center">Template байхгүй байна / No templates</div>
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
              {(() => {
                const expired = msLeftInWindow(conv.lastMessageAt, now) <= 0;
                return (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowTemplates((v) => !v)}
                      disabled={expired}
                      className="px-3 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-colors"
                      title="Templates"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    <input value={text} onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && send()}
                      disabled={expired}
                      placeholder={expired ? '24-hour window closed' : 'Type a message...'}
                      className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-all" />
                    <button
                      onClick={send}
                      disabled={expired || !text.trim()}
                      className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white px-4 rounded-lg hover:from-emerald-600 hover:to-teal-700 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                );
              })()}
            </footer>
            </div>
            <CustomerInfoPanel
              conv={conv}
              onReset={() => resetConv(conv.id)}
              onCreateOrder={() => toast('Захиалга үүсгэх үйлдэл удахгүй нэмэгдэнэ / Order creation coming soon')}
            />
          </>
        )}
      </main>

      {showPhones && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={() => setShowPhones(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Customer Data</h3>
              <button onClick={() => setShowPhones(false)} className="text-slate-500 hover:text-slate-900"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 pt-3 border-b border-slate-200 flex gap-1">
              <button
                onClick={() => setPhonesTab('phones')}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${phonesTab === 'phones' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
              >
                <span className="inline-flex items-center gap-1"><Phone className="w-4 h-4" /> Phone numbers ({phones.length})</span>
              </button>
              {false && (
                <button
                  onClick={() => setPhonesTab('hidden')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${phonesTab === 'hidden' ? 'border-red-600 text-red-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
                >
                  <span className="inline-flex items-center gap-1"><EyeOff className="w-4 h-4" /> Hidden ({hidden.length})</span>
                </button>
              )}
            </div>
            <div className="flex-1 overflow-auto">
              {phonesLoading && <div className="p-8 text-center text-slate-500 text-sm">Ачааллаж байна... / Loading...</div>}
              {!phonesLoading && phonesTab === 'phones' && (
                <>
                  {phones.length === 0 && <div className="p-8 text-center text-slate-500 text-sm">Утас олдсонгүй / No phones found</div>}
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
                                Постыг харах / View post
                              </a>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="font-mono font-bold text-slate-900 mb-1">{p.phone}</div>
                            <a
                              href={`tel:${p.phone}`}
                              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                            >
                              <Phone className="w-3 h-3" /> Дуудах / Call
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
                  {hidden.length === 0 && <div className="p-8 text-center text-slate-500 text-sm">Нуугдсан коммент байхгүй / No hidden comments</div>}
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
                                Постыг харах / View post
                              </a>
                            )}
                          </div>
                          <div className="shrink-0 flex flex-col gap-1">
                            <button
                              onClick={() => unhideComment(h.id)}
                              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100"
                            >
                              <Eye className="w-3 h-3" /> Харуулах / Show
                            </button>
                            <button
                              onClick={() => deleteHiddenComment(h.id)}
                              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                              <Trash2 className="w-3 h-3" /> Устгах / Delete
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

function WindowPill({ lastMessageAt, now }: { lastMessageAt: string | Date; now: number }) {
  const left = msLeftInWindow(lastMessageAt, now);
  const tone = windowTone(left);
  if (tone === 'expired') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-medium">
        Хэтэрсэн / Expired
      </span>
    );
  }
  const totalMin = Math.floor(left / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const txt = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} үлдлээ / left`;
  const cls =
    tone === 'critical'
      ? 'bg-red-100 text-red-700'
      : tone === 'warn'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-emerald-50 text-emerald-700';
  return <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded font-medium ${cls}`}>{txt}</span>;
}

function WindowBanner({ lastMessageAt, now }: { lastMessageAt: string | Date; now: number }) {
  const left = msLeftInWindow(lastMessageAt, now);
  const tone = windowTone(left);
  if (tone === 'expired') {
    return (
      <div className="bg-slate-900 text-white px-6 py-3 flex items-start gap-3 border-t border-slate-800">
        <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <div className="font-semibold">24 цаг хэтэрсэн — мессеж илгээх боломжгүй / 24-hour window closed — cannot send</div>
          <div className="text-slate-300 mt-0.5">
            Meta Business Suite-р орж бичнэ үү / Use Meta Business Suite:{' '}
            <a href="https://business.facebook.com" target="_blank" rel="noopener noreferrer" className="underline text-white">
              business.facebook.com
            </a>
          </div>
        </div>
      </div>
    );
  }
  const countdown = fmtCountdown(left);
  if (tone === 'critical') {
    return (
      <div className="bg-red-50 border-t border-red-200 px-6 py-2 flex items-center gap-2 text-sm text-red-800">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span className="font-semibold">30 минутаас бага үлдлээ! / Less than 30 min left!</span>
        <span className="ml-auto font-mono text-red-900">{countdown}</span>
      </div>
    );
  }
  if (tone === 'warn') {
    return (
      <div className="bg-amber-50 border-t border-amber-200 px-6 py-2 flex items-center gap-2 text-sm text-amber-900">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span className="font-semibold">1 цаг үлдлээ — яаравчлаарай / 1 hour left — hurry up</span>
        <span className="ml-auto font-mono">{countdown}</span>
      </div>
    );
  }
  return (
    <div className="bg-emerald-50 border-t border-emerald-100 px-6 py-1.5 flex items-center gap-2 text-xs text-emerald-800">
      <span>Цонх хаагдахад / Window closes in</span>
      <span className="font-mono font-semibold">{countdown}</span>
      <span>үлдлээ / left</span>
    </div>
  );
}

function MessageBubble({ message }: { message: any }) {
  const fromBot = message.isFromBot && !message.isFromOperator;
  const fromOp = message.isFromOperator;
  const fromUser = !fromBot && !fromOp;
  return (
    <div className={`flex ${fromUser ? 'justify-start' : 'justify-end'} group`}>
      <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
        fromUser ? 'bg-white border border-slate-200 text-slate-900 rounded-bl-md' :
        fromOp ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-br-md' :
        'bg-blue-50 border border-blue-100 text-slate-900 rounded-br-md'
      }`}>
        <div className={`flex items-center gap-1.5 text-[11px] mb-0.5 ${fromOp ? 'text-white/80' : 'text-slate-500'}`}>
          {fromBot ? <><Bot className="w-3 h-3" /> Bot</> : fromOp ? <><User className="w-3 h-3" /> Operator</> : null}
        </div>
        <div className="whitespace-pre-wrap leading-relaxed">{message.text}</div>
      </div>
    </div>
  );
}

function StatusIcon({ status, handoff }: { status: string; handoff: boolean }) {
  if (status === 'closed') return <span className="text-slate-500">Дууссан / Closed</span>;
  if (handoff) return <span className="text-amber-600">Оператор / Operator</span>;
  return <span className="text-emerald-600">Bot</span>;
}

interface CustomerPanelProps {
  conv: any;
  onReset: () => void;
  onCreateOrder: () => void;
}

function CustomerInfoPanel({ conv, onReset, onCreateOrder }: CustomerPanelProps) {
  const ctx = (conv.context as any) || {};
  const cart: any[] = Array.isArray(conv.cart) ? conv.cart : [];
  const latestOrder = Array.isArray(conv.orders) && conv.orders.length > 0 ? conv.orders[0] : null;

  const phone: string | null = ctx.phone || latestOrder?.customerPhone || null;
  const extraPhone: string | null = ctx.extraPhone || latestOrder?.extraPhone || null;
  const address: string | null = ctx.address || latestOrder?.address || null;
  const district: string | null = ctx.district || latestOrder?.district || null;
  const province: string | null = ctx.province || latestOrder?.province || null;
  const note: string | null = ctx.note || latestOrder?.note || null;

  const firstProductName: string | null =
    cart[0]?.product?.name
      || ctx.selectedProduct?.name
      || (Array.isArray(latestOrder?.products) && latestOrder?.products[0]?.productName)
      || null;
  const totalQuantity: number =
    cart.reduce((s, c) => s + (Number(c.quantity) || 0), 0)
      || ctx.quantity
      || (Array.isArray(latestOrder?.products) ? latestOrder!.products.reduce((s: number, p: any) => s + (Number(p.quantity) || 0), 0) : 0);
  const orderTotal: number =
    cart.reduce((s, c) => s + (Number(c.product?.price) || 0) * (Number(c.quantity) || 0), 0)
      || latestOrder?.totalAmount
      || 0;

  const hasPhone = !!phone;
  const hasAddress = !!address;
  const hasProduct = !!firstProductName;

  let statusCls = 'bg-emerald-100 text-emerald-800 border-emerald-300';
  let statusText = 'БЭЛЭН / READY';
  let statusEmoji = 'ok';
  const missingCount = [!hasPhone, !hasAddress, !hasProduct].filter(Boolean).length;
  if (missingCount >= 2) {
    statusCls = 'bg-red-100 text-red-800 border-red-300';
    statusText = 'ДУТУУ / INCOMPLETE';
    statusEmoji = 'red';
  } else if (!hasProduct && hasPhone && hasAddress) {
    statusCls = 'bg-orange-100 text-orange-800 border-orange-300';
    statusText = 'БАРАА ДУТУУ / NO PRODUCT';
    statusEmoji = 'orange';
  } else if (!hasAddress && hasPhone) {
    statusCls = 'bg-amber-100 text-amber-800 border-amber-300';
    statusText = 'ХАЯГ ДУТУУ / NO ADDRESS';
    statusEmoji = 'amber';
  } else if (!hasPhone && hasAddress) {
    statusCls = 'bg-blue-100 text-blue-800 border-blue-300';
    statusText = 'УТАС ДУТУУ / NO PHONE';
    statusEmoji = 'blue';
  }

  const readyForOrder = hasPhone && hasAddress && hasProduct && !!province;

  return (
    <aside className="w-[30%] min-w-[280px] max-w-[420px] border-l border-slate-200 bg-white flex flex-col overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900 text-sm">Customer info</h3>
          <div className="text-[11px] text-slate-400">Хэрэглэгчийн мэдээлэл</div>
        </div>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusCls}`}>
          <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle ${
            statusEmoji === 'ok' ? 'bg-emerald-500' :
            statusEmoji === 'amber' ? 'bg-amber-500' :
            statusEmoji === 'blue' ? 'bg-blue-500' :
            statusEmoji === 'orange' ? 'bg-orange-500' : 'bg-red-500'
          }`} />
          {statusText}
        </span>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3 text-sm">
        <InfoRow icon={<Phone className="w-4 h-4" />} label="Утас / Phone" value={phone} missing={!hasPhone} missingText="ДУТУУ / MISSING" mono />
        <InfoRow icon={<Phone className="w-4 h-4 opacity-70" />} label="Нэмэлт утас / Extra phone" value={extraPhone} mono />
        <InfoRow icon={<Home className="w-4 h-4" />} label="Хаяг / Address" value={address} missing={!hasAddress} missingText="ДУТУУ / MISSING" />
        <InfoRow icon={<MapPin className="w-4 h-4" />} label="Дүүрэг / District" value={district} />
        <InfoRow icon={<Globe2 className="w-4 h-4" />} label="Аймаг/хот / Province/city" value={province} missing={!province} missingText="ДУТУУ / MISSING" />
        <InfoRow icon={<Package className="w-4 h-4" />} label="Бараа / Product" value={firstProductName} missing={!hasProduct} missingText="ДУТУУ / MISSING" />
        <InfoRow icon={<Hash className="w-4 h-4" />} label="Тоо / Quantity" value={totalQuantity ? `${totalQuantity}ш / pcs` : null} />
        <InfoRow icon={<Wallet className="w-4 h-4" />} label="Нийт / Total" value={orderTotal ? `${orderTotal.toLocaleString()}₮` : null} />
        <InfoRow icon={<NotebookPen className="w-4 h-4" />} label="Тэмдэглэл / Note" value={note} />

        {(!hasPhone || !hasAddress || !hasProduct) && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-amber-800 font-semibold text-xs">
              <AlertTriangle className="w-4 h-4" /> Анхааруулга / Warning
            </div>
            {!hasPhone && <div className="text-xs text-amber-900">Утас нэхэж аваарай. / Ask for phone.</div>}
            {!hasAddress && <div className="text-xs text-amber-900">Хаяг нэхэж аваарай. / Ask for address.</div>}
            {!hasProduct && <div className="text-xs text-amber-900">Бараа тодруулаарай. / Confirm product.</div>}
          </div>
        )}

        {latestOrder?.erpOrderId && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <div className="text-xs font-semibold text-emerald-800 mb-0.5">
              ERP захиалга / ERP order
            </div>
            <div className="text-sm font-mono text-emerald-900">
              #{latestOrder.erpOrderNumber || latestOrder.erpOrderId}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 p-3 space-y-2">
        <button
          onClick={onReset}
          className="w-full inline-flex items-center justify-center gap-2 text-sm px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700"
        >
          <RotateCcw className="w-4 h-4" /> Restart Chat
        </button>
        {phone && (
          <a
            href={`tel:${phone}`}
            className="w-full inline-flex items-center justify-center gap-2 text-sm px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            <Phone className="w-4 h-4" /> Дуудах / Call
          </a>
        )}
        {readyForOrder && !latestOrder?.erpOrderId && (
          <button
            onClick={onCreateOrder}
            className="w-full inline-flex items-center justify-center gap-2 text-sm px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            <Package className="w-4 h-4" /> Захиалга үүсгэх / Create order
          </button>
        )}
      </div>
    </aside>
  );
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const pages: (number | '...')[] = [];
  const add = (n: number | '...') => pages.push(n);
  const range = (a: number, b: number) => { for (let i = a; i <= b; i++) add(i); };
  if (totalPages <= 7) {
    range(1, totalPages);
  } else {
    add(1);
    if (page > 4) add('...');
    const s = Math.max(2, page - 1);
    const e = Math.min(totalPages - 1, page + 1);
    range(s, e);
    if (page < totalPages - 3) add('...');
    add(totalPages);
  }
  return (
    <div className="border-t border-slate-200 px-2 py-2 flex items-center justify-center gap-1 bg-white">
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="w-7 h-7 flex items-center justify-center rounded border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`e${i}`} className="px-1 text-xs text-slate-400">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`min-w-[28px] h-7 px-2 text-xs rounded border ${p === page ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}
          >
            {p}
          </button>
        ),
      )}
      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="w-7 h-7 flex items-center justify-center rounded border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function InfoRow({
  icon, label, value, missing, missingText, mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number | null | undefined;
  missing?: boolean;
  missingText?: string;
  mono?: boolean;
}) {
  const displayValue = value !== null && value !== undefined && value !== '' && value !== 0 ? String(value) : null;
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-5 h-5 mt-0.5 text-slate-500 shrink-0 flex items-center justify-center">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
        {displayValue ? (
          <div className={`text-sm text-slate-900 break-words ${mono ? 'font-mono font-medium' : ''}`}>
            {displayValue}
          </div>
        ) : missing ? (
          <div className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-100 border border-amber-300 rounded px-1.5 py-0.5 mt-0.5">
            <AlertTriangle className="w-3 h-3" /> {missingText || 'ДУТУУ / MISSING'}
          </div>
        ) : (
          <div className="text-sm text-slate-400">—</div>
        )}
      </div>
    </div>
  );
}
