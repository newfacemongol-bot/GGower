'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Bot, User, CircleCheck as CheckCircle2, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ConvItem {
  id: string; senderName?: string | null; pageName?: string;
  state: string; isOperatorHandoff: boolean; unreadCount: number;
  lastMessageAt: string; lastMessage?: string; status: string;
}

export default function OperatorPage() {
  const [list, setList] = useState<ConvItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [conv, setConv] = useState<any>(null);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  async function loadList() {
    const r = await fetch('/api/operator/conversations');
    const d = await r.json();
    setList(d.items || []);
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

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  return (
    <div className="h-screen flex bg-slate-50">
      <aside className="w-80 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Чат</h2>
          <button onClick={logout} className="text-slate-500 hover:text-slate-900"><LogOut className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-auto divide-y divide-slate-100">
          {list.map((c) => (
            <button key={c.id} onClick={() => setActiveId(c.id)}
              className={`w-full text-left px-4 py-3 hover:bg-slate-50 ${activeId === c.id ? 'bg-slate-100' : ''}`}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-medium text-slate-900 text-sm truncate">{c.senderName || 'Unknown'}</span>
                {c.unreadCount > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">{c.unreadCount}</span>}
              </div>
              <div className="text-xs text-slate-500 truncate">{c.lastMessage || '—'}</div>
              <div className="flex items-center gap-2 mt-1 text-xs">
                <span className="text-slate-400">{c.pageName}</span>
                <StatusIcon status={c.status} handoff={c.isOperatorHandoff} />
              </div>
            </button>
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
            <div className="flex-1 overflow-auto p-6 space-y-3">
              {conv.messages.map((m: any) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              <div ref={endRef} />
            </div>
            <footer className="bg-white border-t border-slate-200 p-4 flex gap-2">
              <input value={text} onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="Мессеж бичих..." className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900" />
              <button onClick={send} className="bg-slate-900 text-white px-4 rounded-lg hover:bg-slate-800">
                <Send className="w-4 h-4" />
              </button>
            </footer>
          </>
        )}
      </main>
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
