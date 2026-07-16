'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { addDays, format, isSameDay, startOfDay, startOfWeek } from 'date-fns';
import { cn } from '@car-v2/ui';
import { eventColor, resolveDateFnsLocale } from './utils';
import type { CalendarColorMode, CalendarEvent } from './types';

const HOUR_HEIGHT = 44;
const START_HOUR = 6;
const END_HOUR = 22;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => i + START_HOUR);
const SNAP_MINUTES = 15;
const MIN_EVENT_PX = 18;

/* Visible window in minutes-from-midnight + the grid's total pixel height.
 * Events are CLAMPED to this window so an off-hours or long-running trip can
 * never render above/below the grid and bleed outside the calendar card. */
const WIN_START_MIN = START_HOUR * 60; // 06:00
const WIN_END_MIN = (END_HOUR + 1) * 60; // 23:00 (last hour line)
const TOTAL_HEIGHT = HOURS.length * HOUR_HEIGHT;

/* Week view caps how many side-by-side trips render in one overlapping
 * cluster; the rest collapse into a "+N" chip that drills into Day view
 * (where the lane cap is lifted so everything is visible). Day view shows
 * every lane already, so it isn't capped. Mirrors the Month-view pattern. */
const MAX_LANES_WEEK = 3;

interface TimeGridViewProps {
  anchor: Date;
  events: CalendarEvent[];
  dayCount: 1 | 7;
  draggableIds: Set<string>;
  colorMode: CalendarColorMode;
  highlightId?: string | null;
  onEventClick: (id: string) => void;
  onSlotClick: (when: Date) => void;
  onEventDrop: (id: string, newStart: Date) => void;
  /** Click a "+N more" overflow chip (week view) → drill into that day. */
  onMoreClick: (day: Date) => void;
}

interface Positioned {
  ev: CalendarEvent;
  lane: number;
  lanes: number;
  topPx: number;
  heightPx: number;
}

interface Overflow {
  key: string;
  lane: number;
  lanes: number;
  topPx: number;
  heightPx: number;
  count: number;
}

interface DayLayout {
  positioned: Positioned[];
  overflows: Overflow[];
}

const clampMin = (m: number) => Math.min(Math.max(m, WIN_START_MIN), WIN_END_MIN);

/** Convert a clamped [startMin,endMin] window to {topPx,heightPx} that always
 *  stays inside the grid (never negative, never past TOTAL_HEIGHT). */
function toBox(startMin: number, endMin: number): { topPx: number; heightPx: number } {
  const vStart = clampMin(startMin);
  const vEnd = clampMin(endMin);
  let topPx = ((vStart - WIN_START_MIN) / 60) * HOUR_HEIGHT;
  const heightPx = Math.max(MIN_EVENT_PX, ((vEnd - vStart) / 60) * HOUR_HEIGHT - 2);
  if (topPx + heightPx > TOTAL_HEIGHT) topPx = Math.max(0, TOTAL_HEIGHT - heightPx);
  return { topPx, heightPx };
}

function layoutDayEvents(
  dayEvents: CalendarEvent[],
  dayStart: Date,
  maxLanes: number,
): DayLayout {
  if (dayEvents.length === 0) return { positioned: [], overflows: [] };
  const sorted = [...dayEvents].sort((a, b) => a.start.getTime() - b.start.getTime());
  const clusters: CalendarEvent[][] = [];
  let current: CalendarEvent[] = [];
  let currentEnd = 0;
  for (const ev of sorted) {
    if (current.length === 0 || ev.start.getTime() < currentEnd) {
      current.push(ev);
      currentEnd = Math.max(currentEnd, ev.end.getTime());
    } else {
      clusters.push(current);
      current = [ev];
      currentEnd = ev.end.getTime();
    }
  }
  if (current.length) clusters.push(current);

  const dayStartMs = dayStart.getTime();
  const positioned: Positioned[] = [];
  const overflows: Overflow[] = [];

  for (const cluster of clusters) {
    const laneEnds: number[] = [];
    const eventLane = new Map<string, number>();
    for (const ev of cluster) {
      let lane = laneEnds.findIndex((end) => end <= ev.start.getTime());
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(0);
      }
      laneEnds[lane] = ev.end.getTime();
      eventLane.set(ev.id, lane);
    }
    const lanes = laneEnds.length;
    /* Capped only when the cluster genuinely has more concurrent trips than
     * the cap. When capped we reserve the last column for the "+N" chip, so
     * events render across (maxLanes - 1) columns. */
    const capped = lanes > maxLanes;
    const cols = capped ? maxLanes : lanes;
    const visibleCols = capped ? maxLanes - 1 : lanes;

    let hiddenCount = 0;
    let hiddenStartMin = Number.POSITIVE_INFINITY;
    let hiddenEndMin = Number.NEGATIVE_INFINITY;

    for (const ev of cluster) {
      const lane = eventLane.get(ev.id) ?? 0;
      const startMin = (Math.max(ev.start.getTime(), dayStartMs) - dayStartMs) / 60_000;
      const endMin = (ev.end.getTime() - dayStartMs) / 60_000;
      if (capped && lane >= visibleCols) {
        hiddenCount += 1;
        hiddenStartMin = Math.min(hiddenStartMin, startMin);
        hiddenEndMin = Math.max(hiddenEndMin, endMin);
        continue;
      }
      const { topPx, heightPx } = toBox(startMin, endMin);
      positioned.push({ ev, lane, lanes: cols, topPx, heightPx });
    }

    if (hiddenCount > 0) {
      const { topPx, heightPx } = toBox(hiddenStartMin, hiddenEndMin);
      overflows.push({
        key: cluster[0]!.id,
        lane: visibleCols,
        lanes: cols,
        topPx,
        heightPx,
        count: hiddenCount,
      });
    }
  }
  return { positioned, overflows };
}

export function CalendarTimeGridView({
  anchor,
  events,
  dayCount,
  draggableIds,
  colorMode,
  highlightId,
  onEventClick,
  onSlotClick,
  onEventDrop,
  onMoreClick,
}: TimeGridViewProps) {
  const locale = resolveDateFnsLocale(useLocale());

  /* `now` ticks every 60s so the orange now-indicator advances live without
   * the user having to refresh. Cheap re-render — only the indicator + a
   * couple of derived classes use it. */
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  /* `nowTick` is the entire point of this dep — it's how we re-evaluate the
   * Date wall-clock every 60s. ESLint can't tell `new Date()` reads it
   * implicitly via the tick-driven re-render. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => new Date(), [nowTick]);
  const today = now;

  const days = useMemo<Date[]>(() => {
    if (dayCount === 1) return [startOfDay(anchor)];
    const ws = startOfWeek(anchor, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  }, [anchor, dayCount]);

  /* Day view lifts the lane cap (the user drilled in to see everything);
   * week view caps + collapses overflow into a "+N" chip. */
  const maxLanes = dayCount === 1 ? Number.POSITIVE_INFINITY : MAX_LANES_WEEK;

  const eventsByDay = useMemo(() => {
    const map = new Map<number, DayLayout>();
    for (const day of days) {
      const ds = startOfDay(day).getTime();
      const de = ds + 86_400_000;
      const dayEvents = events.filter((ev) => ev.end.getTime() > ds && ev.start.getTime() < de);
      map.set(ds, layoutDayEvents(dayEvents, startOfDay(day), maxLanes));
    }
    return map;
  }, [events, days, maxLanes]);

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-trip-id')) {
      e.preventDefault();
    }
  };

  const handleDrop = (day: Date) => (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('application/x-trip-id');
    if (!events.find((x) => x.id === id)) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const totalMin = (offsetY / HOUR_HEIGHT) * 60 + START_HOUR * 60;
    const snapped = Math.round(totalMin / SNAP_MINUTES) * SNAP_MINUTES;
    const newStart = new Date(day);
    newStart.setHours(0, 0, 0, 0);
    newStart.setMinutes(snapped);
    onEventDrop(id, newStart);
  };

  const handleSlotClick = (day: Date) => (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const totalMin = (offsetY / HOUR_HEIGHT) * 60 + START_HOUR * 60;
    const snapped = Math.round(totalMin / SNAP_MINUTES) * SNAP_MINUTES;
    const when = new Date(day);
    when.setHours(0, 0, 0, 0);
    when.setMinutes(snapped);
    onSlotClick(when);
  };

  const nowTopPx = (() => {
    const minutes = now.getHours() * 60 + now.getMinutes() - START_HOUR * 60;
    if (minutes < 0 || minutes > HOURS.length * 60) return null;
    return (minutes / 60) * HOUR_HEIGHT;
  })();

  /* Auto-scroll viewport so the "now" indicator is near the top of the visible
   * area when the user lands on today. Targets the indicator's DOM element via
   * scrollIntoView — works whether the scroll container is the inner grid, the
   * dashboard's flex-1 page wrapper, or the document itself. Runs once. */
  const nowIndicatorRef = useRef<HTMLDivElement | null>(null);
  const didScrollRef = useRef(false);
  useEffect(() => {
    if (didScrollRef.current) return;
    if (!nowIndicatorRef.current) return;
    if (nowTopPx === null) return;
    if (!days.some((d) => isSameDay(d, now))) return;
    nowIndicatorRef.current.scrollIntoView({ block: 'center', behavior: 'auto' });
    didScrollRef.current = true;
  }, [days, nowTopPx, now]);

  return (
    <div className="flex flex-col bg-surface">
      {/* Day header — sticky so weekday labels stay visible while the user
       * scrolls through the 17-hour grid. Bolder + full-opacity text for
       * legibility. */}
      <div
        className="sticky top-0 z-30 grid border-b border-border bg-surface-2"
        style={{ gridTemplateColumns: `60px repeat(${dayCount}, minmax(0, 1fr))` }}
      >
        <div />
        {days.map((d) => {
          const isToday = isSameDay(d, today);
          const isSat = d.getDay() === 6;
          const isSun = d.getDay() === 0;
          return (
            <div key={d.getTime()} className="px-2 py-1.5 text-center">
              <div
                className={cn(
                  'text-[10px] font-bold uppercase tracking-wide',
                  isSun ? 'text-danger' : isSat ? 'text-info' : 'text-text',
                )}
              >
                {format(d, 'EEE', { locale })}
              </div>
              <div
                className={cn(
                  'mt-0.5 inline-flex h-7 min-w-[28px] items-center justify-center rounded-full px-1 text-sm font-bold tabular',
                  isToday ? 'bg-accent text-accent-fg shadow-xs' : 'text-text',
                )}
              >
                {format(d, 'd', { locale })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: `60px repeat(${dayCount}, minmax(0, 1fr))`,
          height: TOTAL_HEIGHT,
        }}
      >
        {/* Hour gutter */}
        <div className="relative border-r border-border">
          {HOURS.slice(0, -1).map((h) => (
            <div
              key={h}
              className="absolute right-1 -translate-y-1/2 font-mono text-[10px] font-semibold text-text-muted"
              style={{ top: (h - START_HOUR + 1) * HOUR_HEIGHT }}
            >
              {String(h + 1).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {days.map((day) => {
          const ds = startOfDay(day).getTime();
          const layout = eventsByDay.get(ds) ?? { positioned: [], overflows: [] };
          const isToday = isSameDay(day, today);
          return (
            <div
              key={ds}
              className={cn(
                /* `overflow-hidden` guarantees event bars are clipped to the
                 * day column and can never bleed outside the calendar card. */
                'relative overflow-hidden border-r border-border last:border-r-0 cursor-pointer',
                isToday && 'bg-accent-soft/30',
              )}
              onClick={handleSlotClick(day)}
              onDragOver={handleDragOver}
              onDrop={handleDrop(day)}
            >
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="absolute inset-x-0 border-t border-dashed border-border/60"
                  style={{ top: (h - START_HOUR) * HOUR_HEIGHT }}
                />
              ))}

              {isToday && nowTopPx !== null && (
                <div
                  ref={nowIndicatorRef}
                  className="pointer-events-none absolute inset-x-0 z-20"
                  style={{ top: nowTopPx }}
                >
                  <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-accent" />
                  <div className="h-px bg-accent" />
                </div>
              )}

              {layout.positioned.map(({ ev, lane, lanes, topPx, heightPx }) => {
                const colors = eventColor(ev, colorMode);
                const draggable = draggableIds.has(ev.id);
                const widthPct = 100 / lanes;
                return (
                  <button
                    type="button"
                    key={ev.id}
                    draggable={draggable}
                    onDragStart={(e) => {
                      if (!draggable) return;
                      e.dataTransfer.setData('application/x-trip-id', ev.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(ev.id);
                    }}
                    className={cn(
                      'absolute z-10 flex flex-col items-start gap-0.5 overflow-hidden rounded-sm border-l-[3px] px-1.5 py-1 text-left text-[11px] shadow-xs transition-shadow hover:shadow-sm',
                      colors.bg,
                      colors.text,
                      colors.borderL,
                      draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                      ev.id === highlightId && 'ccms-event-highlight',
                    )}
                    style={{
                      top: topPx,
                      height: heightPx,
                      left: `calc(${lane * widthPct}% + 2px)`,
                      width: `calc(${widthPct}% - 4px)`,
                    }}
                  >
                    <span className="font-mono text-[10px] opacity-90">
                      {format(ev.start, 'HH:mm')}–{format(ev.end, 'HH:mm')}
                    </span>
                    <span className="line-clamp-2 font-medium leading-tight">{ev.title}</span>
                  </button>
                );
              })}

              {/* "+N more" overflow chips (week view only) — drill into Day
               * view for the full, uncapped list. */}
              {layout.overflows.map((o) => {
                const widthPct = 100 / o.lanes;
                return (
                  <button
                    type="button"
                    key={`more-${o.key}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoreClick(day);
                    }}
                    className="absolute z-10 flex items-center justify-center rounded-sm border border-border bg-surface-2 px-1 text-[10px] font-semibold text-text-muted shadow-xs transition-colors hover:bg-surface hover:text-accent"
                    style={{
                      top: o.topPx,
                      height: o.heightPx,
                      left: `calc(${o.lane * widthPct}% + 2px)`,
                      width: `calc(${widthPct}% - 4px)`,
                    }}
                  >
                    +{o.count}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
