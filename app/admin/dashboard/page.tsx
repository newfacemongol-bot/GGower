'use client';

import { useEffect, useState } from 'react';
import { ShoppingBag, MessageSquare, CircleCheck as CheckCircle2, Clock, MessageCircle } from 'lucide-react';

interface Stats {
  todayOrders: number;
  totalComments: number;
  repliedComments: number;
  pendingChats: number;
  queuedComments: number;
  pages: { pageId: string; pageName: string; comments: number; conversations: number }[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const load = () => fetch('/api/admin/stats').then((r) => r.json()).then(setStats).catch(() => {});
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="p-8 max-w-7xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Хяналтын самбар</h1>
      <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <Stat label="Өнөөдрийн захиалга" value={stats?.todayOrders ?? 0} icon={<ShoppingBag className="w-5 h-5" />} />
        <Stat label="Өнөөдрийн коммент" value={stats?.totalComments ?? 0} icon={<MessageSquare className="w-5 h-5" />} />
        <Stat label="Хариулсан" value={stats?.repliedComments ?? 0} icon={<CheckCircle2 className="w-5 h-5" />} />
        <Stat label="Queue" value={stats?.queuedComments ?? 0} icon={<Clock className="w-5 h-5" />} />
        <Stat label="Хүлээгдэж буй чат" value={stats?.pendingChats ?? 0} icon={<MessageCircle className="w-5 h-5" />} />
      </div>
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Пэйж статистик</h2>
        </div>
        <div className="divide-y divide-slate-200">
          {(stats?.pages ?? []).map((p) => (
            <div key={p.pageId} className="px-6 py-3 flex items-center justify-between">
              <span className="font-medium text-slate-900">{p.pageName}</span>
              <span className="text-sm text-slate-600">
                {p.comments} коммент · {p.conversations} яриа
              </span>
            </div>
          ))}
          {!stats?.pages?.length && <div className="px-6 py-8 text-center text-slate-500 text-sm">Пэйж байхгүй байна</div>}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-2 text-slate-500">
        <span className="text-xs uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <div className="text-3xl font-bold text-slate-900">{value}</div>
    </div>
  );
}
