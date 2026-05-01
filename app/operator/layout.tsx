'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MessageSquare, MessagesSquare, LogOut } from 'lucide-react';

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

  const links = [
    { href: '/operator', label: 'Чат', icon: MessageSquare },
    { href: '/operator/comments', label: 'Коммент', icon: MessagesSquare },
  ];

  return (
    <div className="h-screen flex bg-slate-50">
      <nav className="w-16 bg-slate-900 flex flex-col items-center py-4 gap-2">
        {links.map((l) => {
          const active = pathname === l.href;
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              title={l.label}
              className={`w-11 h-11 flex items-center justify-center rounded-lg transition ${
                active ? 'bg-white text-slate-900' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
            </Link>
          );
        })}
        <div className="flex-1" />
        <button
          onClick={logout}
          title="Гарах"
          className="w-11 h-11 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </nav>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
