'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/');
      }}
      className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100"
    >
      <LogOut className="w-4 h-4" />
      Гарах / Log out
    </button>
  );
}
