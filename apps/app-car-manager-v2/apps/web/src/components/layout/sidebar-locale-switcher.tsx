'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Check, ChevronsUpDown, Languages, Loader2 } from 'lucide-react';
import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@car-v2/ui';
import { setLocaleAction } from '@/server/actions/locale/locale.actions';

const LOCALES = [
  { id: 'vi', label: 'Tiếng Việt', short: 'VI' },
  { id: 'en', label: 'English',    short: 'EN' },
  { id: 'ko', label: '한국어',      short: 'KO' },
] as const;

interface SidebarLocaleSwitcherProps {
  collapsed: boolean;
}

/* Quick language switcher pinned just above the avatar — admin/manager land
 * here often enough that the round-trip to /settings/me to flip locale was
 * adding friction. Driver path is unchanged (drivers use the mobile bar, no
 * sidebar).
 *
 * Both modes share the same DropdownMenu pattern; only the trigger differs:
 *
 * Expanded (240px sidebar): wide button showing the current locale label +
 *   `VI`/`EN`/`KO` short code, with a chevron hinting at the dropdown.
 *
 * Collapsed (64px sidebar): square icon button (Languages glyph) with a tiny
 *   code badge overlay so users still see what's active. Tooltip on hover.
 *
 * Server action `setLocaleAction` writes `NEXT_LOCALE` cookie + revalidates;
 * we follow with `window.location.reload()` so next-intl's client provider
 * picks up the new message bundle (RSC refresh alone keeps the stale bundle
 * cached at the client provider). */
export function SidebarLocaleSwitcher({ collapsed }: SidebarLocaleSwitcherProps) {
  const locale = useLocale();
  const tMe = useTranslations('settings.me');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const current = LOCALES.find((l) => l.id === locale) ?? LOCALES[0];

  const handleChange = (next: string) => {
    if (next === locale) return;
    startTransition(async () => {
      const res = await setLocaleAction(next);
      if (res.success) {
        /* Full reload: client message bundle is loaded once at provider mount,
         * router.refresh() alone re-renders RSC but keeps the stale bundle. */
        window.location.reload();
      } else {
        router.refresh();
      }
    });
  };

  /* Shared dropdown content — three items with active-state checkmark. */
  const menuItems = LOCALES.map((l) => {
    const active = l.id === locale;
    return (
      <DropdownMenuItem
        key={l.id}
        onSelect={() => handleChange(l.id)}
        className={cn(
          'flex items-center gap-2 cursor-pointer',
          active && 'bg-accent-soft text-accent font-semibold',
        )}
      >
        <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider w-7 inline-block text-center bg-surface-2 text-text-muted rounded px-1 py-0.5">
          {l.short}
        </span>
        <span className="flex-1">{l.label}</span>
        {active && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
      </DropdownMenuItem>
    );
  });

  if (collapsed) {
    return (
      <TooltipProvider delayDuration={400} disableHoverableContent>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={tMe('languageTitle')}
                  disabled={pending}
                  className={cn(
                    'mx-auto flex items-center justify-center h-9 w-9 rounded relative',
                    'text-text-muted hover:bg-surface-2 hover:text-text transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'data-[state=open]:bg-surface-2 data-[state=open]:text-text',
                  )}
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Languages className="h-4 w-4" aria-hidden />
                  )}
                  {/* Tiny code overlay so users see what locale is active even
                   * without opening the menu. Sits in the bottom-right corner. */}
                  <span
                    aria-hidden
                    className="absolute -bottom-0.5 -right-0.5 text-[8px] font-bold leading-none bg-surface px-0.5 rounded text-text-faint border border-border"
                  >
                    {current.short}
                  </span>
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right">{tMe('languageTitle')}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent side="right" align="end" sideOffset={12} className="min-w-[180px]">
            <DropdownMenuLabel>{tMe('languageTitle')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {menuItems}
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipProvider>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={tMe('languageTitle')}
          disabled={pending}
          className={cn(
            'w-full flex items-center gap-2.5 px-2 py-1.5 rounded text-left h-9',
            'transition-colors duration-150 motion-reduce:transition-none',
            'text-text-muted hover:bg-surface-2 hover:text-text',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'data-[state=open]:bg-surface-2 data-[state=open]:text-text',
            pending && 'opacity-60 cursor-wait',
          )}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <Languages className="h-4 w-4 shrink-0" aria-hidden />
          )}
          <span className="flex-1 min-w-0 truncate text-sm font-medium">
            {current.label}
          </span>
          <span className="font-mono text-[10.5px] font-bold tracking-wider text-text-faint shrink-0">
            {current.short}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-text-faint shrink-0" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={8} className="min-w-[--radix-dropdown-menu-trigger-width]">
        <DropdownMenuLabel>{tMe('languageTitle')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {menuItems}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
