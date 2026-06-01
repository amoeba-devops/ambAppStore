'use client';

import { useMemo, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { Avatar, cn } from '@car-v2/ui';
import type { CarTripStatus } from '@car-v2/db/schema';
import type { TripListItem } from '@/server/queries/trips.queries';
import { ClickableCard } from '@/components/clickable-table-row';

type Tone = 'accent' | 'warning' | 'success' | 'info' | 'neutral' | 'danger';

/* Columns follow the state machine left→right (PRD §9.1), then the two terminal
 * branches. All 7 statuses get their own column (product decision) so nothing is
 * hidden — empty columns stay visible to keep the board structurally stable. */
const STATUS_ORDER: readonly CarTripStatus[] = [
  'PENDING_ASSIGNMENT',
  'PENDING_DRIVER_CONFIRMATION',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'REJECTED_BY_DRIVER',
  'CANCELLED',
];

const STATUS_TONE: Record<CarTripStatus, Tone> = {
  PENDING_ASSIGNMENT: 'accent',
  PENDING_DRIVER_CONFIRMATION: 'warning',
  CONFIRMED: 'success',
  IN_PROGRESS: 'info',
  COMPLETED: 'neutral',
  REJECTED_BY_DRIVER: 'danger',
  CANCELLED: 'danger',
};

/** Solid dot per tone — the only chromatic cue on the column header + pills. */
const TONE_DOT: Record<Tone, string> = {
  accent: 'bg-accent',
  warning: 'bg-warning',
  success: 'bg-success',
  info: 'bg-info',
  neutral: 'bg-text-faint',
  danger: 'bg-danger',
};

interface TripBoardProps {
  trips: TripListItem[];
  /**
   * `peek` → card opens the quick-look drawer via `?peek=` on the current path
   * (used on `/trips`). `detail` → card navigates to the full detail page (used
   * on driver/vehicle detail where no drawer exists).
   */
  mode: 'peek' | 'detail';
  /** Show a "results truncated" banner (board hit the server cap). */
  capped?: boolean;
  /**
   * When true (page body, padded `px-4`), columns/pills bleed to the viewport
   * edge via `-mx-4 px-4` so the first/last lane can scroll fully off-screen.
   * Set false when embedding inside a padded Card (detail pages) so the negative
   * margin doesn't punch through the card.
   */
  edgeBleed?: boolean;
  /**
   * Full-height board: the board fills the available height, each column
   * stretches to the bottom, and the CARD AREA of every column scrolls
   * independently when its content overflows — the board container itself never
   * grows the page (Trello/Jira layout). Requires a height-bounded parent
   * (see {@link BoardViewport}).
   *
   * - `true`  → fill at every breakpoint (the standalone `/trips` page).
   * - `'md'`  → fill on md+ only; on mobile the columns size to content and cap
   *   their card area (detail pages, where content sits BELOW the board and a
   *   full-height board would trap page scroll on a phone).
   * - `false` → never fill.
   */
  fillHeight?: boolean | 'md';
}

export function TripBoard({
  trips,
  mode,
  capped = false,
  edgeBleed = true,
  fillHeight = false,
}: TripBoardProps) {
  const fill = fillHeight === true; // fill at all breakpoints
  const fillMd = fillHeight === 'md'; // fill on md+ only
  const t = useTranslations('trips.board');
  const tStatus = useTranslations('trips.status');
  const tList = useTranslations('trips.list');
  const tCommon = useTranslations('common');

  const pathname = usePathname();
  const searchParams = useSearchParams();

  /* For peek mode, the card href preserves every active param (view, q, date…)
   * and just adds `?peek=<id>` so closing the drawer returns to the same board. */
  const buildHref = (trip: TripListItem): string => {
    if (mode === 'detail') return `/trips/${trip.trpId}`;
    const next = new URLSearchParams(searchParams.toString());
    next.set('peek', trip.trpId);
    return `${pathname}?${next.toString()}`;
  };

  const grouped = useMemo(() => {
    const map = new Map<CarTripStatus, TripListItem[]>();
    for (const s of STATUS_ORDER) map.set(s, []);
    for (const trip of trips) map.get(trip.trpStatus)?.push(trip);
    return map;
  }, [trips]);

  /* Column refs so the mobile pill strip can scroll a column into view. */
  const columnRefs = useRef<Partial<Record<CarTripStatus, HTMLElement | null>>>({});
  const scrollToColumn = (status: CarTripStatus) => {
    columnRefs.current[status]?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  };

  const dayLabels = {
    today: tCommon('today'),
    tomorrow: tCommon('tomorrow'),
    yesterday: tCommon('yesterday'),
  };

  /* ── Drag-to-pan (mouse only) ───────────────────────────────────────────
   * `overflow-x-auto` alone only pans via the scrollbar / shift-wheel / a
   * trackpad — a plain mouse can't grab-and-drag the board. We add that here.
   * Touch & pen are left to native scroll (+ scroll-snap on mobile), so we
   * bail unless `pointerType === 'mouse'`. A 6px threshold distinguishes a
   * pan from a click; once exceeded we capture the pointer and suppress the
   * trailing click so dragging over a card never navigates. */
  const scrollerRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, startLeft: 0, moved: false });

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const el = scrollerRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return; // nothing to pan
    drag.current = { active: true, startX: e.clientX, startLeft: el.scrollLeft, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return;
    const el = scrollerRef.current;
    if (!el) return;
    const dx = e.clientX - drag.current.startX;
    if (!drag.current.moved) {
      if (Math.abs(dx) < 6) return;
      drag.current.moved = true;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = 'grabbing';
      el.style.userSelect = 'none';
    }
    el.scrollLeft = drag.current.startLeft - dx;
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return;
    const el = scrollerRef.current;
    drag.current.active = false;
    if (el) {
      el.style.cursor = '';
      el.style.userSelect = '';
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already released */
      }
    }
    /* Keep `moved` set through the click that immediately follows pointerup so
     * onClickCapture can swallow it, then clear on the next tick. */
    if (drag.current.moved) window.setTimeout(() => (drag.current.moved = false), 0);
  };
  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <div className={cn('flex flex-col gap-3 min-w-0', fill && 'h-full min-h-0', fillMd && 'md:h-full md:min-h-0')}>
      {capped && (
        <div className="shrink-0 inline-flex items-center gap-2 rounded-md bg-warning-soft px-3 py-2 text-xs font-medium text-warning">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          {t('cappedNote')}
        </div>
      )}

      {/* ── Mobile: status pill strip ──────────────────────────────────────
       * Horizontal scroller mirroring the columns. Tapping a pill snaps the
       * board to that column — the key affordance that makes a 7-column board
       * usable on a phone without endless swiping. Hidden on md+ where all
       * columns are visible at once. */}
      <div
        className={cn(
          'shrink-0 md:hidden overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
          edgeBleed && '-mx-4 px-4',
        )}
      >
        <div className="inline-flex items-center gap-1.5">
          {STATUS_ORDER.map((status) => {
            const count = grouped.get(status)?.length ?? 0;
            return (
              <button
                key={status}
                type="button"
                onClick={() => scrollToColumn(status)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  'border-border bg-surface text-text-muted hover:text-text',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  count === 0 && 'opacity-55',
                )}
                aria-label={t('jumpAria', { status: tStatus(status), count })}
              >
                <span className={cn('h-2 w-2 rounded-full', TONE_DOT[STATUS_TONE[status]])} aria-hidden />
                <span>{tStatus(status)}</span>
                <span className="tabular text-text-faint">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Columns ────────────────────────────────────────────────────────
       * Mobile: scroll-snap lanes ~84vw wide so the next column peeks (scroll
       * hint). Desktop: fixed 300px columns, no snap. `-mx-4 px-4` lets the
       * first/last lane scroll fully to the edge on mobile. */}
      <div
        ref={scrollerRef}
        data-board-scroller=""
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        className={cn(
          'flex gap-3 overflow-x-auto pb-2 md:cursor-grab',
          'snap-x snap-mandatory md:snap-none',
          /* Take the remaining height so columns can stretch full. */
          fill && 'flex-1 min-h-0',
          fillMd && 'md:flex-1 md:min-h-0',
          edgeBleed && '-mx-4 px-4 md:mx-0 md:px-0',
        )}
      >
        {STATUS_ORDER.map((status) => {
          const items = grouped.get(status) ?? [];
          const tone = STATUS_TONE[status];
          return (
            <section
              key={status}
              ref={(el) => {
                columnRefs.current[status] = el;
              }}
              className={cn(
                'flex flex-col shrink-0 snap-center md:snap-align-none',
                'w-[84vw] sm:w-[320px] md:w-[300px]',
                'rounded-lg border border-border bg-surface-2/40',
                /* Stretch to the board's full height; the header stays put and
                 * the card area below owns the vertical scroll. */
                fill && 'h-full min-h-0',
                fillMd && 'md:h-full md:min-h-0',
              )}
            >
              <header className="shrink-0 flex items-center gap-2 rounded-t-lg border-b border-border bg-surface-2/90 px-3 py-2.5 backdrop-blur">
                <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', TONE_DOT[tone])} aria-hidden />
                <span className="flex-1 truncate text-sm font-semibold text-text">{tStatus(status)}</span>
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-surface px-1.5 text-xs font-semibold tabular text-text-muted">
                  {items.length}
                </span>
              </header>

              {/* Card area = the scroll viewport. Page mode: flex-1 so it fills
               * the column and scrolls when content overflows. Embedded mode:
               * cap height so a long column doesn't run away inside the Card. */}
              <div
                className={cn(
                  'space-y-2 overflow-y-auto p-2',
                  fill && 'flex-1 min-h-0',
                  /* md+ fills & scrolls; mobile keeps a capped height so the
                   * page (with content below) scrolls normally. */
                  fillMd && 'max-h-[60vh] min-h-[88px] md:max-h-none md:min-h-0 md:flex-1',
                  !fill && !fillMd && 'max-h-[60vh] min-h-[88px]',
                )}
              >
                {items.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs italic text-text-faint">{t('emptyColumn')}</p>
                ) : (
                  items.map((trip) => (
                    <ClickableCard
                      key={trip.trpId}
                      href={buildHref(trip)}
                      scroll={mode === 'detail'}
                      aria-label={tList('openAria', { ref: trip.trpRef })}
                      className={cn(
                        'rounded-md border border-border bg-surface px-3 py-2.5',
                        'hover:border-border-strong hover:shadow-xs active:bg-surface-2 transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-text-faint tabular truncate">{trip.trpRef}</span>
                        <span className="text-[11px] text-text-faint tabular shrink-0">
                          {formatWhen(trip.trpScheduledAt, dayLabels)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <Avatar name={trip.passengerName ?? '?'} size="sm" />
                        <span className="font-semibold text-sm text-text truncate leading-tight">
                          {trip.passengerName ?? tCommon('unknown')}
                        </span>
                      </div>
                      <div className="mt-1.5 text-xs text-text-muted leading-snug line-clamp-2">
                        <span className="text-text">{trip.trpPickupAddress}</span>
                        <span className="text-text-faint"> → </span>
                        <span className="text-text">{trip.trpDropoffAddress}</span>
                      </div>
                      <div className="mt-1.5 text-xs text-text-faint truncate">
                        {trip.driverName ? (
                          <>
                            <span className="text-text-muted">{trip.driverName}</span>
                            {trip.vehiclePlate && (
                              <>
                                <span> · </span>
                                <span className="font-mono tabular">{trip.vehiclePlate}</span>
                              </>
                            )}
                          </>
                        ) : (
                          <span className="italic">{tList('unassigned')}</span>
                        )}
                      </div>
                    </ClickableCard>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function formatWhen(
  iso: Date | string,
  labels: { today: string; tomorrow: string; yesterday: string },
): string {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (days === 0) return `${labels.today} · ${time}`;
  if (days === 1) return `${labels.tomorrow} · ${time}`;
  if (days === -1) return `${labels.yesterday} · ${time}`;
  return `${d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })} · ${time}`;
}
