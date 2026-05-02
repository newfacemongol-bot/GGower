'use client';

import { useState } from 'react';
import { toast } from 'sonner';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, role: 'admin' }),
      credentials: 'same-origin',
    });
    if (!res.ok) {
      setLoading(false);
      const d = await res.json().catch(() => ({}));
      toast.error(d.error || 'Буруу нууц үг / Wrong password');
      return;
    }
    window.location.href = '/admin/dashboard';
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <form onSubmit={onSubmit} className="bg-white rounded-xl border border-slate-200 p-8 w-full max-w-sm shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Admin нэвтрэх / Admin login</h1>
        <p className="text-sm text-slate-600 mb-6">Нууц үгээ оруулна уу / Please enter your password</p>
        <input
          type="password"
          placeholder="Нууц үг / Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 mb-4"
          autoFocus
        />
        <button
          disabled={loading}
          className="w-full bg-slate-900 text-white py-2.5 rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? 'Нэвтэрч байна... / Signing in...' : 'Нэвтрэх / Sign in'}
        </button>
      </form>
    </main>
  );
}
