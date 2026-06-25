'use client';

import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { Check, ChevronDown, Globe } from 'lucide-react';
import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@car-v2/ui';
import { setLocaleAction } from '@/server/actions/locale/locale.actions';

const LOCALES = [
  { id: 'vi', short: 'VI', label: 'Tiếng Việt' },
  { id: 'en', short: 'EN', label: 'English' },
  { id: 'ko', short: 'KO', label: '한국어' },
] as const;

interface LoginLanguageSwitcherProps {
  /** aria-label for the trigger button. */
  ariaLabel: string;
}

/* Dropdown locale picker for the /login screen.
 *
 * Trigger is a single ghost button (globe icon + short code + caret) —
 * minimal footprint that fits a 320px viewport without crowding the
 * brand circle below. Menu opens to a list of native-script labels so a
 * user who doesn't yet read the current locale can still recognise their
 * own language by sight.
 *
 * Selection writes the `NEXT_LOCALE` cookie via the same `setLocaleAction`
 * the in-app settings card uses, then reloads to refresh the next-intl
 * provider's message bundle. */
export function LoginLanguageSwitcher({ ariaLabel }: LoginLanguageSwitcherProps) {
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const current = LOCALES.find((l) => l.id === locale) ?? LOCALES[0];

  const handle = (next: string) => {
    if (next === locale || pending) return;
    startTransition(async () => {
      await setLocaleAction(next);
      window.location.reload();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          disabled={pending}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5',
            'text-xs font-semibold text-text-muted',
            'hover:bg-surface-2 hover:text-text active:bg-surface-2/80',
            'transition-colors motion-reduce:transition-none',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
            'data-[state=open]:bg-surface-2 data-[state=open]:text-text',
            pending && 'opacity-50',
          )}
        >
          <Globe className="h-3.5 w-3.5" aria-hidden />
          <span className="tracking-wider">{current.short}</span>
          <ChevronDown className="h-3 w-3 text-text-faint" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-[160px]">
        {LOCALES.map((l) => {
          const active = l.id === locale;
          return (
            <DropdownMenuItem
              key={l.id}
              onSelect={() => handle(l.id)}
              className="flex items-center justify-between gap-3"
            >
              <span className="flex items-center gap-2.5">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-faint w-5">
                  {l.short}
                </span>
                <span className={cn('text-sm', active && 'font-semibold text-accent')}>
                  {l.label}
                </span>
              </span>
              {active && <Check className="h-3.5 w-3.5 text-accent" aria-hidden />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
