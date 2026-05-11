'use client';

import { signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';

export function Topbar({ userName }: { userName: string }) {
  const t = useTranslations('auth');

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
      <div className="text-sm text-muted-foreground">{userName}</div>
      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm hover:bg-muted"
      >
        <LogOut className="h-4 w-4" />
        <span>{t('logout')}</span>
      </button>
    </header>
  );
}
