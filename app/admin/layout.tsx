import Link from 'next/link';
import { LayoutDashboard, MessageCircle, ListOrdered, Settings, Database, Facebook, FileText, MessageSquare, FlaskConical } from 'lucide-react';
import LogoutButton from '@/components/logout-button';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-6 py-5 border-b border-slate-200">
          <h2 className="font-bold text-slate-900">Chatbot Admin</h2>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLink href="/admin/dashboard" icon={<LayoutDashboard className="w-4 h-4" />}>Хяналтын самбар</NavLink>
          <NavLink href="/admin/comments" icon={<MessageCircle className="w-4 h-4" />}>Коммент</NavLink>
          <NavLink href="/admin/queue" icon={<ListOrdered className="w-4 h-4" />}>Queue</NavLink>
          <NavLink href="/admin/settings" icon={<Settings className="w-4 h-4" />}>Тохиргоо</NavLink>
          <NavLink href="/admin/settings/erp" icon={<Database className="w-4 h-4" />}>ERP</NavLink>
          <NavLink href="/admin/settings/pages" icon={<Facebook className="w-4 h-4" />}>Facebook Пэйж</NavLink>
          <NavLink href="/admin/settings/templates" icon={<FileText className="w-4 h-4" />}>Бэлэн хариу</NavLink>
          <NavLink href="/admin/settings/messages" icon={<MessageSquare className="w-4 h-4" />}>Бот мессежүүд</NavLink>
          <NavLink href="/admin/stress-test" icon={<FlaskConical className="w-4 h-4" />}>Стресс тест</NavLink>
        </nav>
        <div className="p-3 border-t border-slate-200">
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

function NavLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900"
    >
      {icon}
      {children}
    </Link>
  );
}
