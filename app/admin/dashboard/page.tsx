'use client';

import { useEffect, useState } from 'react';
import {
  ShoppingBag,
  MessageSquare,
  CircleCheck as CheckCircle2,
  Clock,
  MessageCircle,
  TrendingUp,
  TriangleAlert,
  ShoppingCart,
  ShieldAlert,
  Activity,
} from 'lucide-react';

interface Stats {
  todayOrders: number;
  todayOrdersFailed: number;
  totalComments: number;
  repliedComments: number;
  pendingChats: number;
  queuedComments: number;
  activeNow: number;
  failedOrders: number;
  abandonedCarts: number;
  spamBlocked: number;
  complaintCount: number;
  urgentCount: number;
  conversionRate: number;
  todayConvs: number;
  todayCompletedOrders: number;
  windowClosingIn2h: number;
  windowClosingIn30m: number;
  windowExpired: number;
  pages: { pageId: string; pageName: string; comments: number; conversations: number }[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [tick, setTick] = useState(0);
  const [expiredTokens, setExpiredTokens] = useState<{ id: string; pageName: string }[]>([]);

  useEffect(() => {
    const load = () => fetch('/api/admin/stats').then((r) => r.json()).then(setStats).catch(() => {});
    const loadTokens = () => fetch('/api/admin/pages/token-status').then((r) => r.json()).then((d) => {
      const exp = (d.items || []).filter((it: any) => it.isActive && !it.valid).map((it: any) => ({ id: it.id, pageName: it.pageName }));
      setExpiredTokens(exp);
    }).catch(() => {});
    load();
    loadTokens();
    const id = setInterval(() => {
      load();
      setTick((t) => t + 1);
    }, 5000);
    const idT = setInterval(loadTokens, 60000);
    return () => { clearInterval(id); clearInterval(idT); };
  }, []);

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Хяналтын самбар</h1>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Live · шинэчлэгдсэн {tick * 5}с өмнө
        </div>
      </div>

      {expiredTokens.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-800 flex-1">
            <div className="font-semibold mb-0.5">Токен дууссан пэйж байна</div>
            <div className="text-red-700">
              {expiredTokens.map((p) => p.pageName).join(', ')} токен дууссан байна!{' '}
              <a href="/admin/pages" className="underline font-semibold">Засах → /admin/pages</a>
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Stat label="Одоо идэвхтэй" value={stats?.activeNow ?? 0} icon={<Activity className="w-5 h-5" />} accent="emerald" />
        <Stat label="Өнөөдрийн захиалга" value={stats?.todayOrders ?? 0} icon={<ShoppingBag className="w-5 h-5" />} />
        <Stat label="Conversion" value={`${stats?.conversionRate ?? 0}%`} icon={<TrendingUp className="w-5 h-5" />} accent="blue" />
        <Stat label="Хүлээгдэж буй чат" value={stats?.pendingChats ?? 0} icon={<MessageCircle className="w-5 h-5" />} accent={stats && stats.pendingChats > 0 ? 'amber' : undefined} />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <Stat label="Өнөөдрийн коммент" value={stats?.totalComments ?? 0} icon={<MessageSquare className="w-5 h-5" />} />
        <Stat label="Хариулсан" value={stats?.repliedComments ?? 0} icon={<CheckCircle2 className="w-5 h-5" />} />
        <Stat label="Queue" value={stats?.queuedComments ?? 0} icon={<Clock className="w-5 h-5" />} />
        <Stat label="Орхисон сагс" value={stats?.abandonedCarts ?? 0} icon={<ShoppingCart className="w-5 h-5" />} accent={stats && stats.abandonedCarts > 0 ? 'amber' : undefined} />
        <Stat label="Амжилтгүй захиалга" value={stats?.failedOrders ?? 0} icon={<TriangleAlert className="w-5 h-5" />} accent={stats && stats.failedOrders > 0 ? 'rose' : undefined} />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <Stat
          label="Яаралтай (URGENT)"
          value={stats?.urgentCount ?? 0}
          icon={<TriangleAlert className="w-5 h-5" />}
          accent={stats && stats.urgentCount > 0 ? 'rose' : undefined}
        />
        <Stat
          label="Гомдол (COMPLAINT)"
          value={stats?.complaintCount ?? 0}
          icon={<ShieldAlert className="w-5 h-5" />}
          accent={stats && stats.complaintCount > 0 ? 'amber' : undefined}
        />
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-4">
        <Stat
          label="2 цаг дотор хаагдах"
          value={stats?.windowClosingIn2h ?? 0}
          icon={<Clock className="w-5 h-5" />}
          accent={stats && stats.windowClosingIn2h > 0 ? 'amber' : undefined}
        />
        <Stat
          label="30 минут дотор хаагдах"
          value={stats?.windowClosingIn30m ?? 0}
          icon={<TriangleAlert className="w-5 h-5" />}
          accent={stats && stats.windowClosingIn30m > 0 ? 'rose' : undefined}
        />
        <Stat
          label="24 цаг хэтэрсэн"
          value={stats?.windowExpired ?? 0}
          icon={<ShieldAlert className="w-5 h-5" />}
          accent={stats && stats.windowExpired > 0 ? 'rose' : undefined}
        />
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Өнөөдрийн яриа</div>
          <div className="text-2xl font-bold text-slate-900">{stats?.todayConvs ?? 0}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Өнөөдрийн батлагдсан</div>
          <div className="text-2xl font-bold text-slate-900">{stats?.todayCompletedOrders ?? 0}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" /> Spam блоклосон
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats?.spamBlocked ?? 0}</div>
        </div>
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

function Stat({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent?: 'emerald' | 'blue' | 'amber' | 'rose';
}) {
  const accentMap: Record<string, string> = {
    emerald: 'text-emerald-600',
    blue: 'text-blue-600',
    amber: 'text-amber-600',
    rose: 'text-rose-600',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-2 text-slate-500">
        <span className="text-xs uppercase tracking-wide">{label}</span>
        <span className={accent ? accentMap[accent] : ''}>{icon}</span>
      </div>
      <div className={`text-3xl font-bold ${accent ? accentMap[accent] : 'text-slate-900'}`}>{value}</div>
    </div>
  );
}
