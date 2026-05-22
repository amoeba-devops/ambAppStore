'use client';
import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { endOfDay, format, isSameDay, isSameMonth } from 'date-fns';
import { cn } from '@car-v2/ui';
import {
  assignLanes,
  buildMonthMatrix,
  clipToWeek,
  eventColor,
  eventsInWeek,
  resolveDateFnsLocale,
} from './utils';
import type { CalendarColorMode, CalendarEvent } from './types';

const MAX_LANES = 3;
const LANE_HEIGHT_PX = 20;
const LANE_GAP_PX = 2;
/* Bumped from 28 → 34 to clear the bigger (h-7 = 28px) bold day-number disc
 * with a couple of px breathing room before the first event lane. */
const HEADER_OFFSET_PX = 34;
const ROW_PADDING_PX = 22;

interface MonthViewProps {
  anchor: Date;
  events: CalendarEvent[];
  draggableIds: Set<string>;
  colorMode: CalendarColorMode;
  highlightId?: string | null;
  onEventClick: (eventId: string) => void;
  onSlotClick: (day: Date) => void;
  onEventDrop: (eventId: string, newStart: Date) => void;
  onMoreClick: (day: Date) => void;
}

export function CalendarMonthView({
  anchor,
  events,
  draggableIds,
  colorMode,
  highlightId,
  onEventClick,
  onSlotClick,
  onEventDrop,
  onMoreClick,
}: MonthViewProps) {
  const locale = resolveDateFnsLocale(useLocale());
  const t = useTranslations('dashboard.calendar');
  const today = new Date();
  const matrix = useMemo(() => buildMonthMatrix(anchor), [anchor]);
  const weekdayLabels = useMemo(
    () => matrix[0]?.map((d) => format(d, 'EEE', { locale })) ?? [],
    [matrix, locale],
  );

  return (
    <div className="bg-surface">
      {/* Weekday header — sticky so it remains visible when the calendar
       * scrolls inside its 680px wrapper, and slightly heavier weight
       * (font-bold + text-text) for legibility instead of the previous
       * muted gray which looked washed out. */}
      <div className="sticky top-0 z-10 grid grid-cols-7 border-b border-border bg-surface-2">
        {weekdayLabels.map((label, i) => (
          <div
            key={i}
            className={cn(
              'px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide',
              i === 5 && 'text-info',
              i === 6 && 'text-danger',
              i < 5 && 'text-text',
            )}
          >
            {label}
          </div>
        ))}
      </div>
      <div>
        {matrix.map((week, wi) => (
          <WeekRow
            key={wi}
            week={week}
            events={events}
            anchorMonth={anchor}
            today={today}
            draggableIds={draggableIds}
            colorMode={colorMode}
            highlightId={highlightId}
            onEventClick={onEventClick}
            onSlotClick={onSlotClick}
            onEventDrop={onEventDrop}
            onMoreClick={onMoreClick}
            moreLabel={(n) => t('moreEvents', { count: n })}
          />
        ))}
      </div>
    </div>
  );
}

interface WeekRowProps {
  week: Date[];
  events: CalendarEvent[];
  anchorMonth: Date;
  today: Date;
  draggableIds: Set<string>;
  colorMode: CalendarColorMode;
  highlightId?: string | null;
  onEventClick: (id: string) => void;
  onSlotClick: (day: Date) => void;
  onEventDrop: (id: string, newStart: Date) => void;
  onMoreClick: (day: Date) => void;
  moreLabel: (count: number) => string;
}

function WeekRow({
  week,
  events,
  anchorMonth,
  today,
  draggableIds,
  colorMode,
  highlightId,
  onEventClick,
  onSlotClick,
  onEventDrop,
  onMoreClick,
  moreLabel,
}: WeekRowProps) {
  /* `buildMonthMatrix` guarantees week.length === 7; the useMemo wrappers
   * around weekStart/weekEnd stabilise references so downstream deps don't
   * change every render (react-hooks/exhaustive-deps). */
  const weekStart = useMemo(() => week[0] ?? new Date(), [week]);
  const weekEnd = useMemo(() => week[6] ?? new Date(), [week]);
  const weekEndDay = useMemo(() => endOfDay(weekEnd), [weekEnd]);
  const weekEvents = useMemo(
    () => eventsInWeek(events, weekStart, weekEndDay),
    [events, weekStart, weekEndDay],
  );
  const laneMap = useMemo(() => assignLanes(weekEvents), [weekEvents]);

  const visible = weekEvents.filter((ev) => (laneMap.get(ev.id) ?? 99) < MAX_LANES);
  const hiddenPerDay = new Map<number, number>();
  for (const ev of weekEvents) {
    const lane = laneMap.get(ev.id) ?? 99;
    if (lane < MAX_LANES) continue;
    const span = clipToWeek(ev, weekStart, weekEndDay);
    for (let i = span.startDayIndex; i <= span.endDayIndex; i++) {
      hiddenPerDay.set(i, (hiddenPerDay.get(i) || 0) + 1);
    }
  }

  const rowHeight = HEADER_OFFSET_PX + MAX_LANES * (LANE_HEIGHT_PX + LANE_GAP_PX) + ROW_PADDING_PX;

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-trip-id')) {
      e.preventDefault();
    }
  };

  const handleDrop = (day: Date) => (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('application/x-trip-id');
    const ev = events.find((x) => x.id === id);
    if (!ev) return;
    const orig = ev.start;
    const newStart = new Date(day);
    newStart.setHours(orig.getHours(), orig.getMinutes(), 0, 0);
    onEventDrop(ev.id, newStart);
  };

  return (
    <div className="relative border-b border-border last:border-b-0" style={{ minHeight: rowHeight }}>
      <div className="grid h-full grid-cols-7">
        {week.map((day, di) => {
          const isToday = isSameDay(day, today);
          const isOtherMonth = !isSameMonth(day, anchorMonth);
          const isSat = day.getDay() === 6;
          const isSun = day.getDay() === 0;
          const hiddenCount = hiddenPerDay.get(di) || 0;
          return (
            <div
              key={di}
              role="button"
              tabIndex={-1}
              onClick={() => onSlotClick(day)}
              onDragOver={handleDragOver}
              onDrop={handleDrop(day)}
              className={cn(
                'cursor-pointer border-r border-border px-1.5 py-1 last:border-r-0 hover:bg-accent-soft/40',
                isOtherMonth && 'bg-surface-2/60',
                isToday && 'bg-accent-soft/30',
              )}
            >
              {/* Day number — bigger circle (h-7 w-7) + bold weight so the
               * date is the visual anchor of each cell. Today gets a solid
               * accent disc; out-of-month dates fade to text-faint so the
               * focus month "pops". Default in-month dates use full `text-text`
               * (not `text-text-muted`) for solid contrast. */}
              <div
                className={cn(
                  'inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold tabular',
                  isToday && 'bg-accent text-accent-fg shadow-xs',
                  !isToday && isOtherMonth && 'text-text-faint font-medium',
                  !isToday && !isOtherMonth && isSun && 'text-danger',
                  !isToday && !isOtherMonth && isSat && 'text-info',
                  !isToday && !isOtherMonth && !isSun && !isSat && 'text-text',
                )}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* +N more indicators */}
      {Array.from(hiddenPerDay.entries()).map(([dayIndex, count]) => {
        const day = week[dayIndex];
        if (!day) return null;
        return (
          <button
            key={`more-${dayIndex}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoreClick(day);
            }}
            className="absolute bottom-1 z-10 text-[10px] font-medium text-text-muted hover:text-accent"
            style={{
              left: `calc(${(dayIndex / 7) * 100}% + 4px)`,
              width: `calc(${100 / 7}% - 8px)`,
            }}
          >
            {moreLabel(count)}
          </button>
        );
      })}

      {/* Event bars */}
      <div className="pointer-events-none absolute inset-0">
        {visible.map((ev) => {
          const lane = laneMap.get(ev.id) ?? 0;
          const span = clipToWeek(ev, weekStart, weekEndDay);
          const left = (span.startDayIndex / 7) * 100;
          const width = ((span.endDayIndex - span.startDayIndex + 1) / 7) * 100;
          const top = HEADER_OFFSET_PX + lane * (LANE_HEIGHT_PX + LANE_GAP_PX);
          const colors = eventColor(ev, colorMode);
          const draggable = draggableIds.has(ev.id);
          const startsHere = ev.start.getTime() >= weekStart.getTime();
          const endsHere = ev.end.getTime() <= weekEndDay.getTime();
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
              title={`${ev.title}  ${format(ev.start, 'HH:mm')}–${format(ev.end, 'HH:mm')}`}
              className={cn(
                'pointer-events-auto absolute flex items-center gap-1 truncate border-l-[3px] px-1.5 text-left text-[11px] font-medium leading-none transition-shadow hover:shadow-xs',
                colors.bg,
                colors.text,
                colors.borderL,
                draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                startsHere && 'rounded-l-sm',
                endsHere && 'rounded-r-sm',
                ev.id === highlightId && 'ccms-event-highlight',
              )}
              style={{
                top,
                left: `calc(${left}% + 2px)`,
                width: `calc(${width}% - 4px)`,
                height: LANE_HEIGHT_PX,
              }}
            >
              {startsHere && (
                <span className="shrink-0 font-mono text-[10px] opacity-90">
                  {format(ev.start, 'HH:mm')}
                </span>
              )}
              <span className="truncate">{ev.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
