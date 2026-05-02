'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ListOrdered,
  Settings,
  Database,
  Facebook,
  FileText,
  MessageSquare,
  FlaskConical,
  Bot,
} from 'lucide-react';
import LogoutButton from '@/components/logout-button';

type NavItem = {
  href: string;
  label: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const groups: NavGroup[] = [
  {
    label: 'Main',
    items: [
      { href: '/admin/dashboard', label: 'Dashboard', sub: 'Хяналтын самбар', icon: LayoutDashboard },
      { href: '/admin/queue', label: 'Queue', sub: 'Дараалал', icon: ListOrdered },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { href: '/admin/settings', label: 'Settings', sub: 'Ерөнхий', icon: Settings },
      { href: '/admin/settings/erp', label: 'ERP', sub: 'Системийн холболт', icon: Database },
      { href: '/admin/settings/pages', label: 'Facebook Pages', sub: 'Пэйж', icon: Facebook },
      { href: '/admin/settings/templates', label: 'Templates', sub: 'Бэлэн хариу', icon: FileText },
      { href: '/admin/settings/messages', label: 'Bot Messages', sub: 'Бот мессежүүд', icon: MessageSquare },
    ],
  },
  {
    label: 'Tools',
    items: [{ href: '/admin/stress-test', label: 'Test Data', sub: 'Туршилтын өгөгдөл', icon: FlaskConical }],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-slate-200 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-sm">
            <Bot className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-slate-900 text-sm leading-tight">Chatbot Admin</div>
            <div className="text-[11px] text-slate-500 leading-tight">Messenger operations</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="px-3 mb-1.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active =
                    pathname === item.href ||
                    (item.href !== '/admin/settings' && pathname?.startsWith(item.href)) ||
                    (item.href === '/admin/settings' && pathname === '/admin/settings');
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                        active
                          ? 'bg-emerald-50 text-emerald-900'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-600 rounded-r-full" />
                      )}
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          active ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium leading-tight truncate">{item.label}</div>
                        {item.sub && (
                          <div
                            className={`text-[10px] leading-tight truncate ${
                              active ? 'text-emerald-700/70' : 'text-slate-400'
                            }`}
                          >
                            {item.sub}
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-200">
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
