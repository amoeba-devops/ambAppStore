'use client';
import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { format, isSameDay, startOfDay } from 'date-fns';
import { cn } from '@car-v2/ui';
import { eventColor, resolveDateFnsLocale } from './utils';
import type { CalendarColorMode, CalendarEvent, CalendarVehicle } from './types';

const HOUR_WIDTH = 56;
const ROW_HEIGHT = 44;
const LABEL_WIDTH = 140;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const SNAP_MINUTES = 15;

interface GanttViewProps {
  anchor: Date;
  events: CalendarEvent[];
  vehicles: CalendarVehicle[];
  draggableIds: Set<string>;
  colorMode: CalendarColorMode;
  highlightId?: string | null;
  onEventClick: (id: string) => void;
  onSlotClick: (when: Date, vehicleId: string | null) => void;
  onEventDrop: (id: string, newStart: Date) => void;
}

export function CalendarGanttView({
  anchor,
  events,
  vehicles,
  draggableIds,
  colorMode,
  highlightId,
  onEventClick,
  onSlotClick,
  onEventDrop,
}: GanttViewProps) {
  const t = useTranslations('dashboard.calendar');
  const locale = resolveDateFnsLocale(useLocale());
  /* `now` ticks every 60s so the vertical orange now-line advances live. */
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const today = useMemo(() => new Date(), [nowTick]);
  const isToday = isSameDay(anchor, today);
  const dayStart = useMemo(() => startOfDay(anchor), [anchor]);
  const dayStartMs = dayStart.getTime();

  const eventsByVehicle = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    const ds = dayStartMs;
    const de = ds + 86_400_000;
    for (const ev of events) {
      if (ev.end.getTime() <= ds || ev.start.getTime() >= de) continue;
      const key = ev.vehicleId || '__unassigned__';
      const arr = map.get(key);
      if (arr) arr.push(ev);
      else map.set(key, [ev]);
    }
    return map;
  }, [events, dayStartMs]);

  const rows: Array<{ key: string; label: string; vehicleId: string | null }> = [
    ...vehicles.map((v) => ({ key: v.id, label: v.plate, vehicleId: v.id })),
  ];
  if (eventsByVehicle.has('__unassigned__')) {
    rows.push({ key: '__unassigned__', label: t('unassigned'), vehicleId: null });
  }

  const nowLeftPx = (() => {
    if (!isToday) return null;
    const min = today.getHours() * 60 + today.getMinutes();
    return (min / 60) * HOUR_WIDTH;
  })();

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-trip-id')) {
      e.preventDefault();
    }
  };

  const handleRowDrop = () => (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('application/x-trip-id');
    if (!events.find((x) => x.id === id)) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const totalMin = (offsetX / HOUR_WIDTH) * 60;
    const snapped = Math.max(0, Math.min(24 * 60, Math.round(totalMin / SNAP_MINUTES) * SNAP_MINUTES));
    const newStart = new Date(dayStart);
    newStart.setMinutes(snapped);
    onEventDrop(id, newStart);
  };

  const handleRowClick = (vehicleId: string | null) => (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const totalMin = (offsetX / HOUR_WIDTH) * 60;
    const snapped = Math.max(0, Math.min(24 * 60, Math.round(totalMin / SNAP_MINUTES) * SNAP_MINUTES));
    const when = new Date(dayStart);
    when.setMinutes(snapped);
    onSlotClick(when, vehicleId);
  };

  const totalGridWidth = 24 * HOUR_WIDTH;

  return (
    <div className="flex flex-col bg-surface">
      {/* Header — sticky so the date + hour labels stay anchored while the
       * user scrolls through vehicle rows. Horizontal scroll is delegated to
       * the parent container so header + rows scroll together as one strip. */}
      <div className="sticky top-0 z-30 flex border-b border-border bg-surface-2">
        <div
          className="shrink-0 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-text"
          style={{ width: LABEL_WIDTH }}
        >
          {format(anchor, 'EEE, d MMM', { locale })}
        </div>
        <div className="flex shrink-0" style={{ width: totalGridWidth }}>
          {HOURS.map((h) => (
            <div
              key={h}
              className="shrink-0 border-l border-border px-1 py-2 text-center font-mono text-[10px] font-semibold text-text first:border-l-0"
              style={{ width: HOUR_WIDTH }}
            >
              {String(h).padStart(2, '0')}
            </div>
          ))}
        </div>
      </div>

      {/* Rows — no nested overflow; the parent calendar container handles
       * vertical/horizontal scroll for the whole grid uniformly. */}
      <div>
        {rows.length === 0 ? (
          <div className="py-10 text-center text-xs text-text-muted">—</div>
        ) : (
          rows.map((row) => {
            const rowEvents = eventsByVehicle.get(row.key) || [];
            return (
              <div key={row.key} className="flex border-b border-border last:border-b-0">
                <div
                  className="shrink-0 border-r border-border bg-surface-2 px-3 py-2 font-mono text-sm font-semibold text-text"
                  style={{ width: LABEL_WIDTH, height: ROW_HEIGHT, lineHeight: `${ROW_HEIGHT - 16}px` }}
                >
                  {row.label}
                </div>
                <div
                  className="relative shrink-0 overflow-hidden cursor-pointer hover:bg-accent-soft/30"
                  style={{ width: totalGridWidth, height: ROW_HEIGHT }}
                  onClick={handleRowClick(row.vehicleId)}
                  onDragOver={handleDragOver}
                  onDrop={handleRowDrop()}
                >
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      className="absolute bottom-0 top-0 border-l border-dashed border-border/60 first:border-l-0"
                      style={{ left: h * HOUR_WIDTH }}
                    />
                  ))}

                  {isToday && nowLeftPx !== null && (
                    <div
                      className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-accent"
                      style={{ left: nowLeftPx }}
                    >
                      <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-accent" />
                    </div>
                  )}

                  {rowEvents.map((ev) => {
                    const startMs = Math.max(ev.start.getTime(), dayStartMs);
                    const endMs = Math.min(ev.end.getTime(), dayStartMs + 86_400_000);
                    const startMin = (startMs - dayStartMs) / 60_000;
                    const endMin = (endMs - dayStartMs) / 60_000;
                    const leftPx = (startMin / 60) * HOUR_WIDTH;
                    const widthPx = Math.max(40, ((endMin - startMin) / 60) * HOUR_WIDTH - 2);
                    const colors = eventColor(ev, colorMode);
                    const draggable = draggableIds.has(ev.id);
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
                          'absolute z-10 flex items-center gap-1 overflow-hidden rounded-sm border-l-[3px] px-1.5 text-left text-[11px] shadow-xs transition-shadow hover:shadow-sm',
                          colors.bg,
                          colors.text,
                          colors.borderL,
                          draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                          ev.id === highlightId && 'ccms-event-highlight',
                        )}
                        style={{
                          left: leftPx + 1,
                          width: widthPx,
                          top: 4,
                          height: ROW_HEIGHT - 8,
                        }}
                      >
                        <span className="shrink-0 font-mono text-[10px] opacity-90">
                          {format(ev.start, 'HH:mm')}
                        </span>
                        <span className="truncate font-medium">{ev.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
