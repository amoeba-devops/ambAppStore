'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, ChevronsUpDown, Languages, Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardHeaderText,
  CardTitle,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@car-v2/ui';
import { setLocaleAction } from '@/server/actions/locale/locale.actions';

const LOCALES = [
  { id: 'vi', label: 'Tiếng Việt', short: 'VI' },
  { id: 'en', label: 'English',    short: 'EN' },
  { id: 'ko', label: '한국어',      short: 'KO' },
] as const;

/* Language switcher card — dropdown variant matching the sidebar's compact
 * locale switcher, so the interaction is identical across breakpoints.
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

  const current = LOCALES.find((l) => l.id === locale) ?? LOCALES[0];

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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={tMe('languageTitle')}
              disabled={pending}
              className={cn(
                'w-full h-11 flex items-center gap-3 px-3.5 rounded-lg border border-border bg-surface',
                'text-left transition-colors motion-reduce:transition-none',
                'hover:bg-surface-2 active:bg-surface-2/80',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'data-[state=open]:bg-surface-2 data-[state=open]:border-accent/40',
                pending && 'opacity-60 cursor-wait',
              )}
            >
              <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider w-9 inline-flex items-center justify-center bg-accent-soft text-accent rounded px-1.5 py-1 shrink-0">
                {current.short}
              </span>
              <span className="flex-1 min-w-0 truncate text-sm font-medium text-text">
                {current.label}
              </span>
              <ChevronsUpDown className="h-4 w-4 text-text-faint shrink-0" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          {/* `min-w-[--radix-dropdown-menu-trigger-width]` makes the menu the
           * same width as the trigger button. Default side=bottom — on a card
           * placed mid-page this opens downward into free space. */}
          <DropdownMenuContent
            side="bottom"
            align="start"
            sideOffset={6}
            className="min-w-[--radix-dropdown-menu-trigger-width]"
          >
            <DropdownMenuLabel>{tMe('languageTitle')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {LOCALES.map((l) => {
              const active = l.id === locale;
              return (
                <DropdownMenuItem
                  key={l.id}
                  onSelect={() => handle(l.id)}
                  className={cn(
                    'flex items-center gap-3 cursor-pointer py-2.5',
                    active && 'bg-accent-soft text-accent font-semibold',
                  )}
                >
                  <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider w-9 inline-flex items-center justify-center bg-surface-2 text-text-muted rounded px-1.5 py-1 shrink-0">
                    {l.short}
                  </span>
                  <span className="flex-1">{l.label}</span>
                  {active && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}
