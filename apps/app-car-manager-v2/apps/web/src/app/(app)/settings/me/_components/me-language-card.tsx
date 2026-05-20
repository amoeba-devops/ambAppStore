'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Languages, Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardHeaderText,
  CardTitle,
  cn,
} from '@car-v2/ui';
import { setLocaleAction } from '@/server/actions/locale/locale.actions';

const LOCALES = [
  { id: 'vi', label: 'Tiếng Việt' },
  { id: 'en', label: 'English' },
  { id: 'ko', label: '한국어' },
] as const;

/* Language switcher card.
 *
 * Server action `setLocaleAction` writes the `NEXT_LOCALE` cookie + revalidates
 * the root layout. We follow up with `window.location.reload()` so client
 * components currently mounted (next-intl loads messages at provider mount)
 * pick up the new locale immediately — `revalidatePath` alone re-renders RSCs
 * but the client message bundle stays cached until a full reload. */
export function MeLanguageCard() {
  const tMe = useTranslations('settings.me');
  const locale = useLocale();
  const [pending, startTransition] = useTransition();

  const handle = (next: string) => {
    if (next === locale) return;
    startTransition(async () => {
      await setLocaleAction(next);
      window.location.reload();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardHeaderText>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <Languages className="h-4 w-4 text-text-muted" aria-hidden />
              {tMe('languageTitle')}
            </span>
          </CardTitle>
        </CardHeaderText>
        {pending && <Loader2 className="h-4 w-4 animate-spin text-text-muted" aria-hidden />}
      </CardHeader>
      <CardContent>
        <div role="radiogroup" aria-label={tMe('languageTitle')} className="grid grid-cols-3 gap-2">
          {LOCALES.map((l) => {
            const active = l.id === locale;
            return (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={pending}
                onClick={() => handle(l.id)}
                className={cn(
                  'rounded-lg border-2 px-3 py-3 text-sm font-semibold',
                  'transition-colors motion-reduce:transition-none',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                  active
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-border bg-surface text-text hover:bg-surface-2',
                  pending && 'opacity-60',
                )}
              >
                <div className="text-xs font-bold uppercase tracking-wider mb-0.5">{l.id}</div>
                <div className="text-xs font-medium">{l.label}</div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
