'use client';

import { useEffect, useState } from 'react';
import {
  ShoppingBag,
  Clock,
  MessageCircle,
  TrendingUp,
  TriangleAlert,
  ShoppingCart,
  ShieldAlert,
  Activity,
  CircleCheck,
  Users,
  Facebook,
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

const isDemoMode = true;

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

  const maxPage = Math.max(1, ...(stats?.pages ?? []).map((p) => p.conversations));

  return (
    <div className="w-full px-6 lg:px-8 py-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Хяналтын самбар · бодит цагийн дүн</p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs text-slate-600">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-medium text-slate-700">Live</span>
          <span className="text-slate-300">·</span>
          <span>updated {tick * 5}s ago</span>
        </div>
      </header>

      {!isDemoMode && expiredTokens.length > 0 && (
        <div className="mb-6 bg-white border border-rose-200 rounded-xl px-5 py-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
          </div>
          <div className="text-sm flex-1">
            <div className="font-semibold text-slate-900 mb-0.5">Expired page token(s)</div>
            <div className="text-slate-600">
              {expiredTokens.map((p) => p.pageName).join(', ')} token expired.{' '}
              <a href="/admin/pages" className="underline font-medium text-rose-600">Edit pages</a>
            </div>
          </div>
        </div>
      )}

      <section className="mb-8">
        <SectionHeader title="Overview" />
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
        >
          <StatCard label="Active now" sub="Одоо идэвхтэй" value={stats?.activeNow ?? 0} icon={<Activity className="w-4 h-4" />} tone="emerald" pulse />
          <StatCard label="Today's orders" sub="Өнөөдрийн захиалга" value={stats?.todayOrders ?? 0} icon={<ShoppingBag className="w-4 h-4" />} />
          <StatCard label="Conversion" sub="Хөрвүүлэлт" value={`${stats?.conversionRate ?? 0}%`} icon={<TrendingUp className="w-4 h-4" />} tone="blue" />
          <StatCard label="Pending chats" sub="Хүлээгдэж буй" value={stats?.pendingChats ?? 0} icon={<MessageCircle className="w-4 h-4" />} tone={stats && stats.pendingChats > 0 ? 'amber' : 'neutral'} />
          <StatCard label="Today's chats" sub="Өнөөдрийн яриа" value={stats?.todayConvs ?? 0} icon={<Users className="w-4 h-4" />} tone="blue" />
          <StatCard label="Confirmed" sub="Батлагдсан" value={stats?.todayCompletedOrders ?? 0} icon={<CircleCheck className="w-4 h-4" />} tone="emerald" />
        </div>
      </section>

      <section className="mb-8">
        <SectionHeader title="Attention needed" />
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
        >
          <StatCard label="Abandoned carts" sub="Орхигдсон сагс" value={stats?.abandonedCarts ?? 0} icon={<ShoppingCart className="w-4 h-4" />} tone={stats && stats.abandonedCarts > 0 ? 'amber' : 'neutral'} />
          <StatCard label="Failed orders" sub="Амжилтгүй" value={stats?.failedOrders ?? 0} icon={<TriangleAlert className="w-4 h-4" />} tone={stats && stats.failedOrders > 0 ? 'rose' : 'neutral'} />
          <StatCard label="Urgent" sub="Яаралтай" value={stats?.urgentCount ?? 0} icon={<TriangleAlert className="w-4 h-4" />} tone={stats && stats.urgentCount > 0 ? 'rose' : 'neutral'} />
          <StatCard label="Complaints" sub="Гомдол" value={stats?.complaintCount ?? 0} icon={<ShieldAlert className="w-4 h-4" />} tone={stats && stats.complaintCount > 0 ? 'amber' : 'neutral'} />
          <StatCard label="Spam blocked" sub="Спам" value={stats?.spamBlocked ?? 0} icon={<ShieldAlert className="w-4 h-4" />} />
        </div>
      </section>

      <section className="mb-8">
        <SectionHeader title="Messaging window" subtitle="24 цагийн цонх" />
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
        >
          <StatCard label="Closing in 2h" sub="2 цаг дотор" value={stats?.windowClosingIn2h ?? 0} icon={<Clock className="w-4 h-4" />} tone={stats && stats.windowClosingIn2h > 0 ? 'amber' : 'neutral'} />
          <StatCard label="Closing in 30 min" sub="30 минут дотор" value={stats?.windowClosingIn30m ?? 0} icon={<TriangleAlert className="w-4 h-4" />} tone={stats && stats.windowClosingIn30m > 0 ? 'rose' : 'neutral'} />
          <StatCard label="Expired" sub="Хэтэрсэн" value={stats?.windowExpired ?? 0} icon={<ShieldAlert className="w-4 h-4" />} tone={stats && stats.windowExpired > 0 ? 'rose' : 'neutral'} />
        </div>
      </section>

      <section>
        <SectionHeader title="Pages" subtitle="Пэйжийн ачаалал" />
        <div className="bg-white rounded-2xl border border-slate-200">
          <div className="divide-y divide-slate-100">
            {(stats?.pages ?? []).map((p) => {
              const pct = Math.round((p.conversations / maxPage) * 100);
              return (
                <div key={p.pageId} className="px-6 py-4 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center shrink-0">
                        <Facebook className="w-4 h-4" />
                      </div>
                      <span className="font-medium text-slate-900 truncate">{p.pageName}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-900 tabular-nums">
                      {p.conversations} <span className="text-xs font-normal text-slate-400">chats</span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-900 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {!stats?.pages?.length && (
              <div className="px-6 py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <Facebook className="w-5 h-5 text-slate-400" />
                </div>
                <div className="text-sm font-medium text-slate-700">No pages yet</div>
                <div className="text-xs text-slate-400 mt-0.5">Пэйж байхгүй байна</div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3 flex items-baseline gap-2">
      <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">{title}</h2>
      {subtitle && <span className="text-xs text-slate-400">· {subtitle}</span>}
    </div>
  );
}

const toneStyles: Record<string, { icon: string; value: string }> = {
  neutral: { icon: 'bg-slate-50 text-slate-500', value: 'text-slate-900' },
  emerald: { icon: 'bg-emerald-50 text-emerald-600', value: 'text-slate-900' },
  blue: { icon: 'bg-blue-50 text-blue-600', value: 'text-slate-900' },
  amber: { icon: 'bg-amber-50 text-amber-600', value: 'text-slate-900' },
  rose: { icon: 'bg-rose-50 text-rose-600', value: 'text-slate-900' },
};

function StatCard({
  label,
  sub,
  value,
  icon,
  tone = 'neutral',
  pulse = false,
}: {
  label: string;
  sub?: string;
  value: number | string;
  icon: React.ReactNode;
  tone?: keyof typeof toneStyles;
  pulse?: boolean;
}) {
  const t = toneStyles[tone];
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 min-h-[140px] flex flex-col justify-between transition-all duration-200 hover:shadow-sm hover:border-slate-300">
      <div className="flex items-center justify-between">
        <div className={`w-8 h-8 rounded-lg ${t.icon} flex items-center justify-center`}>{icon}</div>
        {pulse && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        )}
      </div>
      <div className="mt-4">
        <div className={`text-3xl font-bold ${t.value} tabular-nums tracking-tight leading-none`}>{value}</div>
        <div className="mt-2">
          <div className="text-sm font-semibold text-slate-900 leading-tight">{label}</div>
          {sub && <div className="text-xs text-slate-500 leading-tight mt-0.5">{sub}</div>}
        </div>
      </div>
    </div>
  );
}
