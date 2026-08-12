'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import * as Popover from '@radix-ui/react-popover';
import { CalendarRange, Check, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { format, isSameDay, isSameMonth, isSameWeek } from 'date-fns';
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@car-v2/ui';
import type { CalendarColorMode, CalendarRangeFilter, CalendarViewType } from './types';
import { formatHeaderTitle, resolveDateFnsLocale } from './utils';

interface ToolbarProps {
  anchor: Date;
  view: CalendarViewType;
  onView: (v: CalendarViewType) => void;
  onPrev: () => void;
  onNext: () => void;
  colorMode: CalendarColorMode;
  onColorMode: (m: CalendarColorMode) => void;
  /** Active filter (if any) — drives chip highlight + info badge. */
  rangeFilter: CalendarRangeFilter | null;
  /** Apply a preset filter (today / week / month). Sets view + anchor. */
  onQuickFilter: (kind: 'today' | 'this-week' | 'this-month') => void;
  /** Apply a custom range. Caller decides which view to land on based on
   * the span; toolbar only forwards the user's picks. */
  onCustomRange: (start: Date, end: Date) => void;
  /** Clear any custom range filter — caller resets to the default month view
   * anchored on today. */
  onClearFilter: () => void;
  /** How many trips the visible range holds. Sits next to the navigator
   * because that is the control the user just moved — the page header's own
   * count is deliberately period-free (it cannot follow client state). */
  tripCount: number;
}

const VIEWS: CalendarViewType[] = ['month', 'week', 'day', 'gantt'];
const COLOR_MODES: CalendarColorMode[] = ['vehicle', 'status'];
const QUICK_FILTERS: Array<{ kind: 'today' | 'this-week' | 'this-month'; key: string }> = [
  { kind: 'today',      key: 'filterToday' },
  { kind: 'this-week',  key: 'filterWeek' },
  { kind: 'this-month', key: 'filterMonth' },
];

/** Local datetime-local string ↔ Date helpers (avoids the UTC offset trap
 * inherent to `toISOString` when feeding `<input type="date">`). */
function toDateInput(d: Date): string {
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

/** Detect which preset (if any) the current (view, anchor) state already
 * matches — used to highlight the active chip without needing extra state. */
function detectQuickKind(view: CalendarViewType, anchor: Date): 'today' | 'this-week' | 'this-month' | null {
  const now = new Date();
  if (view === 'day' && isSameDay(anchor, now)) return 'today';
  if (view === 'week' && isSameWeek(anchor, now, { weekStartsOn: 1 })) return 'this-week';
  if (view === 'month' && isSameMonth(anchor, now)) return 'this-month';
  return null;
}

export function CalendarToolbar({
  anchor,
  view,
  onView,
  onPrev,
  onNext,
  colorMode,
  onColorMode,
  rangeFilter,
  onQuickFilter,
  onCustomRange,
  onClearFilter,
  tripCount,
}: ToolbarProps) {
  const t = useTranslations('dashboard.calendar');
  const tColor = useTranslations('dashboard.colorMode');
  const locale = resolveDateFnsLocale(useLocale());
  const title = formatHeaderTitle(anchor, view, locale);

  const activeQuick = rangeFilter?.kind === 'custom' ? null : detectQuickKind(view, anchor);
  const isCustomActive = rangeFilter?.kind === 'custom';

  /* Local state for the custom-range popover — committed to parent only when
   * the user clicks "Áp dụng". Initial values reflect any active custom range
   * so re-opening the popover doesn't lose what's already applied. */
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [pickerStart, setPickerStart] = useState('');
  const [pickerEnd, setPickerEnd] = useState('');
  useEffect(() => {
    if (!popoverOpen) return;
    if (rangeFilter?.kind === 'custom') {
      setPickerStart(toDateInput(rangeFilter.start));
      setPickerEnd(toDateInput(rangeFilter.end));
    } else {
      const today = new Date();
      setPickerStart(toDateInput(today));
      setPickerEnd(toDateInput(today));
    }
  }, [popoverOpen, rangeFilter]);

  const handleApplyCustom = () => {
    if (!pickerStart || !pickerEnd) return;
    const start = new Date(pickerStart);
    const end = new Date(pickerEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return;
    /* Use end-of-day for the inclusive `end` so a single-day pick still
     * yields a non-empty range when forwarded to listTripsForCalendar. */
    end.setHours(23, 59, 59, 999);
    setPopoverOpen(false);
    onCustomRange(start, end);
  };

  /* Format the active filter for the info badge — shows a human-friendly
   * range label plus the underlying date span. */
  const activeFilterLabel = (() => {
    if (isCustomActive && rangeFilter) {
      const s = format(rangeFilter.start, 'd MMM', { locale });
      const e = format(rangeFilter.end, 'd MMM yyyy', { locale });
      return { name: t('filterCustom'), range: `${s} → ${e}` };
    }
    if (activeQuick === 'today') return { name: t('filterToday'), range: format(new Date(), 'EEEE, d MMM yyyy', { locale }) };
    if (activeQuick === 'this-week') return { name: t('filterWeek'), range: title };
    if (activeQuick === 'this-month') return { name: t('filterMonth'), range: title };
    return null;
  })();

  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-border bg-surface-2 px-3 py-2">
      {/* ── ROW 1: nav arrows + title + view picker ──────────────────────
       * Single horizontal line on every breakpoint. Mobile uses a compact
       * dropdown for the view picker (saving ~36px of vertical) while
       * desktop keeps the segmented control for at-a-glance scanning. */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          aria-label="prev"
          className="shrink-0 rounded-sm p-1.5 text-text-muted hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onNext}
          aria-label="next"
          className="shrink-0 rounded-sm p-1.5 text-text-muted hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1 truncate text-sm font-semibold capitalize text-text">
          {title}
          {/* Count for the range on screen. Whole right rail follows the same
           * number, so this is also the user's confirmation that navigating
           * actually re-scoped the page. */}
          <span className="ml-2 font-normal normal-case text-xs tabular text-text-muted">
            {t('tripCount', { count: tripCount })}
          </span>
        </div>

        {/* Desktop: color mode segmented (vehicle vs status). Hidden on
         * mobile where horizontal space goes to title + view picker. */}
        <div className="hidden shrink-0 rounded-sm border border-border bg-surface p-0.5 md:inline-flex">
          {COLOR_MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onColorMode(m)}
              className={cn(
                'rounded-sm px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                colorMode === m ? 'bg-accent text-accent-fg' : 'text-text-muted hover:text-text',
              )}
            >
              {tColor(m === 'vehicle' ? 'byVehicle' : 'byStatus')}
            </button>
          ))}
        </div>

        {/* Desktop: segmented view picker. */}
        <div className="hidden shrink-0 rounded-sm border border-border bg-surface p-0.5 md:inline-flex">
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onView(v)}
              className={cn(
                'rounded-sm px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                view === v ? 'bg-accent text-accent-fg' : 'text-text-muted hover:text-text',
              )}
            >
              {t(v)}
            </button>
          ))}
        </div>

        {/* Mobile: view dropdown. Trigger shows current view + chevron;
         * tapping opens a Radix menu with all 4 options. Keeps the toolbar
         * to a single 32px-tall row instead of a 32+36px stacked control. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t(view)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-sm border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden',
              )}
            >
              <span>{t(view)}</span>
              <ChevronDown className="h-3 w-3 text-text-muted" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} className="min-w-[140px]">
            {VIEWS.map((v) => (
              <DropdownMenuItem
                key={v}
                onSelect={() => onView(v)}
                className="flex items-center justify-between gap-2"
              >
                <span>{t(v)}</span>
                {view === v && <Check className="h-3.5 w-3.5 text-accent" aria-hidden />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── ROW 2: filter chips ─────────────────────────────────────────
       * Single horizontal scroll lane — `flex-nowrap` + `overflow-x-auto`
       * keeps the chips on one line on the narrowest viewport (320px)
       * instead of wrapping into ugly 2-row layouts. `-mx-3 px-3` extends
       * the scroll surface to the toolbar's outer padding so the first/
       * last chip can scroll fully off-screen without clipping. */}
      <div className="-mx-3 flex items-center gap-2 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {QUICK_FILTERS.map(({ kind, key }) => {
          const active = activeQuick === kind;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => onQuickFilter(kind)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? 'border-accent bg-accent text-accent-fg'
                  : 'border-border bg-surface text-text-muted hover:border-accent/40 hover:text-text',
              )}
            >
              {t(key)}
            </button>
          );
        })}

        {/* Custom range — Popover host (Radix). Trigger looks like the chip
         * group so the visual rhythm holds. */}
        <Popover.Root open={popoverOpen} onOpenChange={setPopoverOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isCustomActive
                  ? 'border-accent bg-accent text-accent-fg'
                  : 'border-border bg-surface text-text-muted hover:border-accent/40 hover:text-text',
              )}
            >
              <CalendarRange className="h-3 w-3" />
              {t('filterCustom')}
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="start"
              sideOffset={6}
              className={cn(
                'z-50 rounded-md border border-border bg-surface p-3 shadow-pop',
                'data-[state=open]:animate-in data-[state=closed]:animate-out',
                'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
              )}
            >
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1 text-[11px] font-medium text-text-muted">
                    {t('filterFrom')}
                    <input
                      type="date"
                      value={pickerStart}
                      max={pickerEnd || undefined}
                      onChange={(e) => setPickerStart(e.target.value)}
                      className="rounded-sm border border-border bg-surface px-2 py-1 text-xs text-text focus:border-accent focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] font-medium text-text-muted">
                    {t('filterTo')}
                    <input
                      type="date"
                      value={pickerEnd}
                      min={pickerStart || undefined}
                      onChange={(e) => setPickerEnd(e.target.value)}
                      className="rounded-sm border border-border bg-surface px-2 py-1 text-xs text-text focus:border-accent focus:outline-none"
                    />
                  </label>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPopoverOpen(false)}
                  >
                    {t('filterCancel')}
                  </Button>
                  <Button
                    type="button"
                    variant="accent"
                    size="sm"
                    onClick={handleApplyCustom}
                    disabled={!pickerStart || !pickerEnd || pickerStart > pickerEnd}
                  >
                    {t('filterApply')}
                  </Button>
                </div>
              </div>
              <Popover.Arrow className="fill-border" />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        {/* Active-range info — ONLY for custom ranges. Quick filters already
         * communicate their state via the highlighted chip, so duplicating
         * it as a separate badge was confusing the user ("why does 'Hôm
         * nay' appear twice?"). Custom ranges legitimately add new info
         * (the date span) and get a dismissible badge. */}
        {isCustomActive && activeFilterLabel && (
          <div
            className={cn(
              'ml-auto inline-flex shrink-0 items-center gap-2 rounded-md border border-accent/30 bg-accent-soft/40 px-2.5 py-1',
              'text-[11px] font-medium text-accent',
            )}
            aria-live="polite"
          >
            <CalendarRange className="h-3 w-3" aria-hidden />
            <span className="font-semibold">{activeFilterLabel.name}</span>
            <span className="text-text-muted">·</span>
            <span className="text-text">{activeFilterLabel.range}</span>
            <button
              type="button"
              onClick={onClearFilter}
              aria-label={t('clearFilter')}
              className="rounded-full p-0.5 text-text-muted hover:bg-accent/10 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
