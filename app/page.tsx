import Link from 'next/link';
import { MessageSquare, Shield } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">Facebook Chatbot</h1>
          <p className="text-slate-600">30 пэйж, 400+ boost зар, 24/7 автомат систем / 30 pages, 400+ boosted ads, 24/7 automated system</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <Link
            href="/admin/login"
            className="group bg-white rounded-xl border border-slate-200 p-8 hover:border-slate-900 hover:shadow-lg transition-all"
          >
            <Shield className="w-10 h-10 text-slate-700 mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-1">Админ самбар / Admin Panel</h2>
            <p className="text-sm text-slate-600">ERP, пэйж, тохиргоо удирдах / Manage ERP, pages, settings</p>
          </Link>
          <Link
            href="/operator/login"
            className="group bg-white rounded-xl border border-slate-200 p-8 hover:border-slate-900 hover:shadow-lg transition-all"
          >
            <MessageSquare className="w-10 h-10 text-slate-700 mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-1">Оператор самбар / Operator Panel</h2>
            <p className="text-sm text-slate-600">Live chat, захиалгын дэмжлэг / Live chat, order support</p>
          </Link>
        </div>
      </div>
    </main>
  );
}
