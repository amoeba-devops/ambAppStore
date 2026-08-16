'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import {
  cn,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@car-v2/ui';

/**
 * URL-param-driven MULTI-select for SSR list filters (REQ-20260814 — the truck
 * picker on Chi phí & Lợi nhuận). Sibling of `ParamSelect`, which stays the
 * single-value `<select>` used by the Khu vực / Trạng thái filters.
 *
 * Two deliberate differences from `ParamSelect`:
 *  - Ticking a row does NOT navigate. The draft lives in local state and only
 *    "Áp dụng" pushes `?{param}=a,b,c`, so picking five trucks costs one SSR
 *    round-trip instead of five.
 *  - Selecting everything (or nothing) DELETES the param rather than listing
 *    every id — an untouched filter and a fully-ticked one are the same query,
 *    and the URL stays short enough to share.
 *
 * The server re-derives the real scope from the param anyway
 * (`resolveVehicleScope`), so a stale or crafted value here is harmless.
 */
export function ParamMultiSelect({
  param,
  values,
  options,
  allLabel,
  buttonLabel,
  title,
  applyLabel,
  clearLabel,
}: {
  param: string;
  /** Currently applied selection (empty = all). */
  values: string[];
  options: { value: string; label: string; hint?: string }[];
  /** Label of the "select everything" row inside the popover. */
  allLabel: string;
  /** Trigger label for the APPLIED selection, rendered server-side ("3 xe" /
   * "Tất cả xe"). A formatter function can't cross the RSC boundary, and the
   * applied count is known on the server anyway — the draft count only matters
   * once the user hits Apply, which re-renders the page. */
  buttonLabel: string;
  title: string;
  applyLabel: string;
  clearLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const sp = useSearchParams();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(values);

  /* Re-sync when the applied selection changes underneath us — a back/forward
   * navigation, or another filter (month, region) re-rendering the page. */
  useEffect(() => {
    setDraft(values);
    /* Compare by value: `values` is a fresh array on every render. */
  }, [values.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (value: string) =>
    setDraft((d) => (d.includes(value) ? d.filter((v) => v !== value) : [...d, value]));

  const apply = (next: string[]) => {
    const params = new URLSearchParams(sp?.toString());
    /* Nothing or everything → the default "all" state, with no param. */
    if (next.length === 0 || next.length === options.length) params.delete(param);
    else params.set(param, next.join(','));
    setOpen(false);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  /* Canonical order so the label and the URL follow the option list, not the
   * order the user happened to click in. */
  const ordered = options.filter((o) => draft.includes(o.value)).map((o) => o.value);
  const isFiltered = values.length > 0 && values.length < options.length;
  const allChecked = ordered.length === 0 || ordered.length === options.length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-11 md:h-9 items-center gap-2 rounded-md border bg-surface px-2.5 text-sm text-text',
            'focus-visible:outline-none focus-visible:border-accent',
            isFiltered ? 'border-accent' : 'border-border',
          )}
        >
          <span className="max-w-[12rem] truncate">{buttonLabel}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-text-faint" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        /* Mobile: near-full-width sheet-like panel with 44px rows; desktop: a
         * normal popover. Capped in height so a large fleet stays scrollable. */
        className="z-50 max-h-[70vh] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto p-1"
      >
        <div className="px-2 py-1.5 text-xs font-medium uppercase tracking-wider text-text-faint">
          {title}
        </div>

        <DropdownMenuCheckboxItem
          checked={allChecked}
          onSelect={(e) => e.preventDefault()}
          onCheckedChange={() => setDraft([])}
          className="min-h-[44px] md:min-h-0 font-semibold"
        >
          {allLabel}
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />

        {options.map((o) => (
          <DropdownMenuCheckboxItem
            key={o.value}
            checked={draft.includes(o.value)}
            /* Keep the menu open — this is a multi-select, not a command menu. */
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={() => toggle(o.value)}
            className="min-h-[44px] md:min-h-0"
          >
            <span className="flex-1 truncate">{o.label}</span>
            {o.hint && <span className="ml-2 shrink-0 text-xs text-text-faint">{o.hint}</span>}
          </DropdownMenuCheckboxItem>
        ))}

        <DropdownMenuSeparator />

        <div className="flex items-center justify-between gap-2 p-1">
          <button
            type="button"
            onClick={() => setDraft([])}
            className="rounded-md px-2 py-1.5 text-xs text-text-muted hover:bg-surface-2"
          >
            {clearLabel}
          </button>
          <button
            type="button"
            onClick={() => apply(ordered)}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/90"
          >
            {applyLabel}
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
