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
    <div className="p-6 sm:p-8 max-w-[1400px] mx-auto">
      <header className="mb-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">Хяналтын самбар · бодит цагийн дүн</p>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs text-slate-600 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-medium text-slate-700">Live</span>
            <span className="text-slate-400">·</span>
            <span>updated {tick * 5}s ago</span>
          </div>
        </div>
      </header>

      {!isDemoMode && expiredTokens.length > 0 && (
        <div className="mb-6 bg-gradient-to-r from-rose-50 to-rose-50/50 border border-rose-200 rounded-xl px-5 py-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-rose-100 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
          </div>
          <div className="text-sm text-rose-900 flex-1">
            <div className="font-semibold mb-0.5">Expired page token(s)</div>
            <div className="text-rose-700">
              {expiredTokens.map((p) => p.pageName).join(', ')} token expired.{' '}
              <a href="/admin/pages" className="underline font-semibold">Edit pages</a>
            </div>
          </div>
        </div>
      )}

      <section className="mb-10">
        <SectionHeader title="Overview" subtitle="Гол үзүүлэлтүүд" />
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <HeroStat label="Active now" sub="Одоо идэвхтэй" value={stats?.activeNow ?? 0} icon={<Activity className="w-5 h-5" />} accent="emerald" pulse />
          <HeroStat label="Today's orders" sub="Өнөөдрийн захиалга" value={stats?.todayOrders ?? 0} icon={<ShoppingBag className="w-5 h-5" />} accent="slate" />
          <HeroStat label="Conversion" sub="Хөрвүүлэлт" value={`${stats?.conversionRate ?? 0}%`} icon={<TrendingUp className="w-5 h-5" />} accent="blue" />
          <HeroStat label="Pending chats" sub="Хүлээгдэж буй" value={stats?.pendingChats ?? 0} icon={<MessageCircle className="w-5 h-5" />} accent={stats && stats.pendingChats > 0 ? 'amber' : 'slate'} />
        </div>
      </section>

      <section className="mb-10">
        <SectionHeader title="Attention needed" subtitle="Анхаарал хандуулах" />
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MiniStat label="Abandoned carts" sub="Орхигдсон сагс" value={stats?.abandonedCarts ?? 0} icon={<ShoppingCart className="w-4 h-4" />} tone={stats && stats.abandonedCarts > 0 ? 'amber' : 'neutral'} />
          <MiniStat label="Failed orders" sub="Амжилтгүй захиалга" value={stats?.failedOrders ?? 0} icon={<TriangleAlert className="w-4 h-4" />} tone={stats && stats.failedOrders > 0 ? 'rose' : 'neutral'} />
          <MiniStat label="Urgent" sub="Яаралтай" value={stats?.urgentCount ?? 0} icon={<TriangleAlert className="w-4 h-4" />} tone={stats && stats.urgentCount > 0 ? 'rose' : 'neutral'} />
          <MiniStat label="Complaints" sub="Гомдол" value={stats?.complaintCount ?? 0} icon={<ShieldAlert className="w-4 h-4" />} tone={stats && stats.complaintCount > 0 ? 'amber' : 'neutral'} />
        </div>
      </section>

      <section className="mb-10">
        <SectionHeader title="Messaging window" subtitle="24 цагийн цонх" />
        <div className="grid md:grid-cols-3 gap-4">
          <WindowCard
            label="Closing in 2h"
            sub="2 цаг дотор хаагдах"
            value={stats?.windowClosingIn2h ?? 0}
            tone={stats && stats.windowClosingIn2h > 0 ? 'amber' : 'neutral'}
            icon={<Clock className="w-4 h-4" />}
          />
          <WindowCard
            label="Closing in 30 min"
            sub="30 минут дотор"
            value={stats?.windowClosingIn30m ?? 0}
            tone={stats && stats.windowClosingIn30m > 0 ? 'rose' : 'neutral'}
            icon={<TriangleAlert className="w-4 h-4" />}
          />
          <WindowCard
            label="Expired"
            sub="24 цаг хэтэрсэн"
            value={stats?.windowExpired ?? 0}
            tone={stats && stats.windowExpired > 0 ? 'rose' : 'neutral'}
            icon={<ShieldAlert className="w-4 h-4" />}
          />
        </div>
      </section>

      <section className="mb-10">
        <SectionHeader title="Today" subtitle="Өнөөдрийн нэгдсэн үзүүлэлт" />
        <div className="grid md:grid-cols-3 gap-4">
          <SummaryCard icon={<Users className="w-5 h-5" />} label="Today's chats" sub="Өнөөдрийн яриа" value={stats?.todayConvs ?? 0} tint="blue" />
          <SummaryCard icon={<CircleCheck className="w-5 h-5" />} label="Confirmed" sub="Батлагдсан захиалга" value={stats?.todayCompletedOrders ?? 0} tint="emerald" />
          <SummaryCard icon={<ShieldAlert className="w-5 h-5" />} label="Spam blocked" sub="Спам блоклосон" value={stats?.spamBlocked ?? 0} tint="slate" />
        </div>
      </section>

      <section>
        <SectionHeader title="Pages" subtitle="Пэйжийн ачаалал" />
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {(stats?.pages ?? []).map((p) => {
              const pct = Math.round((p.conversations / maxPage) * 100);
              return (
                <div key={p.pageId} className="px-6 py-4 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Facebook className="w-4 h-4" />
                      </div>
                      <span className="font-medium text-slate-900 truncate">{p.pageName}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-700 tabular-nums">{p.conversations} <span className="text-xs font-normal text-slate-400">chats</span></span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {!stats?.pages?.length && (
              <div className="px-6 py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <Facebook className="w-5 h-5 text-slate-400" />
                </div>
                <div className="text-sm font-medium text-slate-600">No pages yet</div>
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
    <div className="mb-4 flex items-baseline gap-2">
      <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">{title}</h2>
      {subtitle && <span className="text-xs text-slate-400">· {subtitle}</span>}
    </div>
  );
}

const accentStyles: Record<string, { icon: string; value: string; bar: string; bg: string }> = {
  emerald: { icon: 'bg-emerald-50 text-emerald-600', value: 'text-slate-900', bar: 'bg-emerald-500', bg: 'from-emerald-500/5 to-transparent' },
  blue: { icon: 'bg-blue-50 text-blue-600', value: 'text-slate-900', bar: 'bg-blue-500', bg: 'from-blue-500/5 to-transparent' },
  amber: { icon: 'bg-amber-50 text-amber-600', value: 'text-amber-700', bar: 'bg-amber-500', bg: 'from-amber-500/5 to-transparent' },
  rose: { icon: 'bg-rose-50 text-rose-600', value: 'text-rose-700', bar: 'bg-rose-500', bg: 'from-rose-500/5 to-transparent' },
  slate: { icon: 'bg-slate-100 text-slate-600', value: 'text-slate-900', bar: 'bg-slate-400', bg: 'from-slate-500/5 to-transparent' },
};

function HeroStat({
  label,
  sub,
  value,
  icon,
  accent = 'slate',
  pulse = false,
}: {
  label: string;
  sub?: string;
  value: number | string;
  icon: React.ReactNode;
  accent?: keyof typeof accentStyles;
  pulse?: boolean;
}) {
  const a = accentStyles[accent];
  return (
    <div className={`relative bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${a.bg} pointer-events-none`} />
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className={`w-10 h-10 rounded-xl ${a.icon} flex items-center justify-center`}>{icon}</div>
          {pulse && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
        </div>
        <div className={`text-3xl font-bold ${a.value} tabular-nums tracking-tight`}>{value}</div>
        <div className="mt-1">
          <div className="text-sm font-medium text-slate-700">{label}</div>
          {sub && <div className="text-xs text-slate-400">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

const toneStyles: Record<string, { icon: string; value: string; ring: string }> = {
  neutral: { icon: 'bg-slate-100 text-slate-500', value: 'text-slate-900', ring: 'border-slate-200' },
  amber: { icon: 'bg-amber-100 text-amber-700', value: 'text-amber-700', ring: 'border-amber-200' },
  rose: { icon: 'bg-rose-100 text-rose-700', value: 'text-rose-700', ring: 'border-rose-200' },
};

function MiniStat({
  label,
  sub,
  value,
  icon,
  tone = 'neutral',
}: {
  label: string;
  sub?: string;
  value: number | string;
  icon: React.ReactNode;
  tone?: keyof typeof toneStyles;
}) {
  const t = toneStyles[tone];
  return (
    <div className={`bg-white rounded-xl border ${t.ring} p-4 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between gap-3">
        <div className={`w-8 h-8 rounded-lg ${t.icon} flex items-center justify-center shrink-0`}>{icon}</div>
        <div className={`text-2xl font-bold ${t.value} tabular-nums`}>{value}</div>
      </div>
      <div className="mt-3">
        <div className="text-sm font-medium text-slate-700">{label}</div>
        {sub && <div className="text-xs text-slate-400">{sub}</div>}
      </div>
    </div>
  );
}

function WindowCard({
  label,
  sub,
  value,
  icon,
  tone,
}: {
  label: string;
  sub?: string;
  value: number;
  icon: React.ReactNode;
  tone: keyof typeof toneStyles;
}) {
  const t = toneStyles[tone];
  return (
    <div className={`bg-white rounded-xl border ${t.ring} p-5 shadow-sm`}>
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-3">
        <span className={`w-6 h-6 rounded-md ${t.icon} flex items-center justify-center`}>{icon}</span>
        <span>{label}</span>
      </div>
      <div className={`text-3xl font-bold ${t.value} tabular-nums`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

const tintStyles: Record<string, string> = {
  blue: 'from-blue-500/10 to-blue-500/0 text-blue-600',
  emerald: 'from-emerald-500/10 to-emerald-500/0 text-emerald-600',
  slate: 'from-slate-500/10 to-slate-500/0 text-slate-600',
};

function SummaryCard({
  icon,
  label,
  sub,
  value,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  value: number;
  tint: keyof typeof tintStyles;
}) {
  return (
    <div className={`relative bg-white rounded-2xl border border-slate-200 p-5 shadow-sm overflow-hidden`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${tintStyles[tint]} pointer-events-none`} />
      <div className="relative flex items-center gap-4">
        <div className={`w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center ${tintStyles[tint].split(' ').pop()}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-bold text-slate-900 tabular-nums leading-tight">{value}</div>
          <div className="text-sm font-medium text-slate-700 leading-tight">{label}</div>
          {sub && <div className="text-xs text-slate-400 leading-tight">{sub}</div>}
        </div>
      </div>
    </div>
  );
}
