'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useLocale } from 'next-intl';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { cn } from '@v2/ui';
import { locales, localeNames, type Locale } from '@/i18n/config';
import { setLocaleAction } from '@/server/actions/locale.actions';

export function LanguageSwitcher() {
  const current = useLocale() as Locale;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (next: Locale) => {
    if (next === current) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      await setLocaleAction(next);
      setOpen(false);
    });
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
          open
            ? 'border-info-500 bg-info-50 text-info-500'
            : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50',
          pending && 'opacity-60',
        )}
      >
        <Globe className="h-3.5 w-3.5" />
        <span>{localeNames[current]}</span>
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-full z-30 mt-1 w-36 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg"
        >
          {locales.map((loc) => {
            const active = loc === current;
            return (
              <li key={loc}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => pick(loc)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors',
                    active
                      ? 'bg-info-50 font-semibold text-info-500'
                      : 'text-neutral-700 hover:bg-neutral-50',
                  )}
                >
                  <span>{localeNames[loc]}</span>
                  {active && <Check className="h-3 w-3" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
