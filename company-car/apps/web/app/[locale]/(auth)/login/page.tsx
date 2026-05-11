'use client';

import { signIn } from 'next-auth/react';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const t = useTranslations('auth');
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') ?? '/dashboard';
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(form: FormData) {
    setError(null);
    start(async () => {
      const res = await signIn('credentials', {
        email: form.get('email'),
        password: form.get('password'),
        redirect: false,
        callbackUrl,
      });
      if (!res || res.error) {
        setError(t('invalidCredentials'));
        return;
      }
      window.location.href = res.url ?? callbackUrl;
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">{t('loginTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('loginSubtitle')}</p>

        <form action={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">
              {t('email')}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium">
              {t('password')}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition disabled:opacity-60"
          >
            {pending ? '...' : t('submit')}
          </button>
        </form>
      </div>
    </main>
  );
}
