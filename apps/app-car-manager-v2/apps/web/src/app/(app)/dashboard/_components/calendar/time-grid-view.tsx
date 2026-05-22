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
}

interface Positioned {
  ev: CalendarEvent;
  lane: number;
  lanes: number;
  topPx: number;
  heightPx: number;
}

function layoutDayEvents(dayEvents: CalendarEvent[], dayStart: Date): Positioned[] {
  if (dayEvents.length === 0) return [];
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
  const result: Positioned[] = [];
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
    for (const ev of cluster) {
      const lane = eventLane.get(ev.id) ?? 0;
      const startMs = Math.max(ev.start.getTime(), dayStartMs);
      const endMs = ev.end.getTime();
      const startMin = (startMs - dayStartMs) / 60_000;
      const endMin = (endMs - dayStartMs) / 60_000;
      const topPx = Math.max(0, ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT);
      const heightPx = Math.max(18, ((endMin - startMin) / 60) * HOUR_HEIGHT - 2);
      result.push({ ev, lane, lanes, topPx, heightPx });
    }
  }
  return result;
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

  const eventsByDay = useMemo(() => {
    const map = new Map<number, Positioned[]>();
    for (const day of days) {
      const ds = startOfDay(day).getTime();
      const de = ds + 86_400_000;
      const dayEvents = events.filter((ev) => ev.end.getTime() > ds && ev.start.getTime() < de);
      map.set(ds, layoutDayEvents(dayEvents, startOfDay(day)));
    }
    return map;
  }, [events, days]);

  const totalHeight = HOURS.length * HOUR_HEIGHT;

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
        className="sticky top-0 z-10 grid border-b border-border bg-surface-2"
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
          height: totalHeight,
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
          const positioned = eventsByDay.get(ds) || [];
          const isToday = isSameDay(day, today);
          return (
            <div
              key={ds}
              className={cn(
                'relative border-r border-border last:border-r-0 cursor-pointer',
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

              {positioned.map(({ ev, lane, lanes, topPx, heightPx }) => {
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
