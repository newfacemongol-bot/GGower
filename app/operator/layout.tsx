'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MessageSquare, LogOut, Bot } from 'lucide-react';

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === '/operator/login') {
    return <>{children}</>;
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/operator/login');
  }

  const links = [{ href: '/operator', label: 'Chat', icon: MessageSquare }];

  return (
    <div className="h-screen flex bg-slate-50">
      <nav className="w-16 bg-slate-900 flex flex-col items-center py-4 gap-2 border-r border-slate-800">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-lg mb-2">
          <Bot className="w-5 h-5" />
        </div>
        <div className="w-8 h-px bg-slate-800 mb-2" />
        {links.map((l) => {
          const active = pathname === l.href;
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              title={l.label}
              className={`relative w-11 h-11 flex items-center justify-center rounded-lg transition-all ${
                active
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-emerald-400 rounded-r-full -ml-3" />
              )}
              <Icon className="w-5 h-5" />
            </Link>
          );
        })}
        <div className="flex-1" />
        <button
          onClick={logout}
          title="Log out"
          className="w-11 h-11 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </nav>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
