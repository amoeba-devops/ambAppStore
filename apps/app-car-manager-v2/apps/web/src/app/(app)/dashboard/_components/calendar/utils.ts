import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  max as maxDate,
  min as minDate,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { enUS, ko, vi } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import type { CarTripStatus } from '@car-v2/db/schema';
import type { CalendarColorMode, CalendarEvent, CalendarViewType } from './types';
import type { TripListItem } from '@/server/queries/trips.queries';

const FALLBACK_DURATION_MIN = 60;

export function resolveDateFnsLocale(lng: string): Locale {
  if (lng === 'vi') return vi;
  if (lng === 'ko') return ko;
  return enUS;
}

/**
 * Tailwind class bundles per status. Tokens defined in tokens.css
 * (`accent-soft`, `success-soft`, etc.). Border-l uses solid token color.
 */
export interface StatusClasses {
  bg: string;
  text: string;
  borderL: string;
}

/* Each chip uses a saturated background + white foreground (`-fg` tokens =
 * pure white per `packages/ui/src/tokens.css`). Earlier we mistakenly paired
 * `bg-*-soft` (~95% lightness, almost white) with `text-*-fg` (white) →
 * white-on-white made event labels invisible. Solid background + white text
 * matches the Cargorush reference and gives strong contrast without needing
 * extra outlines. COMPLETED / CANCELLED stay neutral (greyed out by design). */
const STATUS_CLASSES: Record<CarTripStatus, StatusClasses> = {
  PENDING_ASSIGNMENT:          { bg: 'bg-accent',     text: 'text-accent-fg',  borderL: 'border-l-accent'     },
  PENDING_DRIVER_CONFIRMATION: { bg: 'bg-warning',    text: 'text-warning-fg', borderL: 'border-l-warning'    },
  CONFIRMED:                   { bg: 'bg-success',    text: 'text-success-fg', borderL: 'border-l-success'    },
  IN_PROGRESS:                 { bg: 'bg-info',       text: 'text-info-fg',    borderL: 'border-l-info'       },
  COMPLETED:                   { bg: 'bg-surface-2',  text: 'text-text-muted', borderL: 'border-l-border-strong' },
  REJECTED_BY_DRIVER:          { bg: 'bg-danger',     text: 'text-danger-fg',  borderL: 'border-l-danger'     },
  CANCELLED:                   { bg: 'bg-surface-2',  text: 'text-text-faint', borderL: 'border-l-border-strong' },
};

export function statusClasses(status: CarTripStatus): StatusClasses {
  return STATUS_CLASSES[status];
}

/* Per-vehicle palette — same contrast principle: saturated background + white
 * text so chips stay readable regardless of the underlying status. Hash maps
 * each vehicle deterministically to a slot (3 vehicles per PRD §1.1 → no
 * collisions in practice; past 8 hues wrap). */
const VEHICLE_PALETTE: StatusClasses[] = [
  /* blue   */ { bg: 'bg-info',    text: 'text-info-fg',    borderL: 'border-l-info'    },
  /* purple */ { bg: 'bg-purple',  text: 'text-purple-fg',  borderL: 'border-l-purple'  },
  /* orange */ { bg: 'bg-accent',  text: 'text-accent-fg',  borderL: 'border-l-accent'  },
  /* green  */ { bg: 'bg-success', text: 'text-success-fg', borderL: 'border-l-success' },
  /* red    */ { bg: 'bg-danger',  text: 'text-danger-fg',  borderL: 'border-l-danger'  },
  /* amber  */ { bg: 'bg-warning', text: 'text-warning-fg', borderL: 'border-l-warning' },
  /* Second pass with subtle border-mix so neighbours look distinct
   * even when the same hue wraps. */
  { bg: 'bg-info',   text: 'text-info-fg',   borderL: 'border-l-accent' },
  { bg: 'bg-accent', text: 'text-accent-fg', borderL: 'border-l-info'   },
];

const UNASSIGNED_VEHICLE_CLASSES: StatusClasses = {
  bg: 'bg-surface-2',
  text: 'text-text-muted',
  borderL: 'border-l-border-strong',
};

function hashStringToIndex(str: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % mod;
}

export function vehicleColor(vehicleId: string | null): StatusClasses {
  if (!vehicleId) return UNASSIGNED_VEHICLE_CLASSES;
  const idx = hashStringToIndex(vehicleId, VEHICLE_PALETTE.length);
  return VEHICLE_PALETTE[idx] ?? UNASSIGNED_VEHICLE_CLASSES;
}

/** Resolve event chip color based on current colorMode. */
export function eventColor(ev: CalendarEvent, mode: CalendarColorMode): StatusClasses {
  if (mode === 'vehicle') return vehicleColor(ev.vehicleId);
  return statusClasses(ev.status);
}

export function tripToCalendarEvent(trip: TripListItem): CalendarEvent {
  const start = new Date(trip.trpScheduledAt);
  const durationMin = trip.trpDurationMinutes ?? FALLBACK_DURATION_MIN;
  const end = new Date(start.getTime() + durationMin * 60_000);
  return {
    id: trip.trpId,
    ref: trip.trpRef,
    title: [trip.vehiclePlate, trip.passengerName].filter(Boolean).join(' · ') || trip.trpRef,
    start,
    end,
    status: trip.trpStatus,
    creatorId: trip.trpCreatorId,
    vehicleId: trip.trpVehicleId,
    vehiclePlate: trip.vehiclePlate ?? '',
    driverName: trip.driverName ?? '',
    passengerName: trip.passengerName ?? '',
  };
}

/** 6 rows of 7 days covering the full month grid, starting Monday. */
export function buildMonthMatrix(anchor: Date): Date[][] {
  const gridStart = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const rows: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
  return rows;
}

export function buildWeekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/**
 * Greedy interval graph coloring — assigns each event to the lowest-numbered
 * lane such that lanes never contain overlapping events.
 */
export function assignLanes(events: CalendarEvent[]): Map<string, number> {
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  const laneEnds: number[] = [];
  const result = new Map<string, number>();
  for (const ev of sorted) {
    let placed = false;
    for (let i = 0; i < laneEnds.length; i++) {
      const end = laneEnds[i];
      if (end !== undefined && end <= ev.start.getTime()) {
        laneEnds[i] = ev.end.getTime();
        result.set(ev.id, i);
        placed = true;
        break;
      }
    }
    if (!placed) {
      result.set(ev.id, laneEnds.length);
      laneEnds.push(ev.end.getTime());
    }
  }
  return result;
}

export function eventsInWeek(events: CalendarEvent[], weekStart: Date, weekEnd: Date): CalendarEvent[] {
  const s = startOfDay(weekStart).getTime();
  const e = endOfDay(weekEnd).getTime();
  return events.filter((ev) => ev.end.getTime() >= s && ev.start.getTime() <= e);
}

export function clipToWeek(
  ev: CalendarEvent,
  weekStart: Date,
  weekEnd: Date,
): { startDayIndex: number; endDayIndex: number } {
  const clippedStart = maxDate([ev.start, weekStart]);
  const clippedEnd = minDate([ev.end, endOfDay(weekEnd)]);
  const startDayIndex = Math.max(
    0,
    Math.floor((startOfDay(clippedStart).getTime() - startOfDay(weekStart).getTime()) / 86_400_000),
  );
  const endDayIndex = Math.min(
    6,
    Math.floor((startOfDay(clippedEnd).getTime() - startOfDay(weekStart).getTime()) / 86_400_000),
  );
  return { startDayIndex, endDayIndex };
}

export function moveAnchor(anchor: Date, view: CalendarViewType, dir: -1 | 1): Date {
  if (view === 'month') return addMonths(anchor, dir);
  if (view === 'week') return addWeeks(anchor, dir);
  return addDays(anchor, dir);
}

export function formatHeaderTitle(anchor: Date, view: CalendarViewType, locale: Locale): string {
  if (view === 'month') return format(anchor, 'LLLL yyyy', { locale });
  if (view === 'day' || view === 'gantt') return format(anchor, 'PPP', { locale });
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  const end = endOfWeek(anchor, { weekStartsOn: 1 });
  return `${format(start, 'd MMM', { locale })} – ${format(end, 'd MMM yyyy', { locale })}`;
}

/**
 * Computes [start, end) range to fetch trips for a given anchor + view.
 * Range padded ±7 days for Month to cover prev/next month spill.
 */
export function rangeForView(anchor: Date, view: CalendarViewType): { start: Date; end: Date } {
  if (view === 'month') {
    const start = addDays(startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }), -1);
    const end = addDays(endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }), 1);
    return { start, end };
  }
  if (view === 'week') {
    const start = startOfWeek(anchor, { weekStartsOn: 1 });
    const end = addDays(endOfWeek(anchor, { weekStartsOn: 1 }), 1);
    return { start, end };
  }
  const start = startOfDay(anchor);
  const end = endOfDay(anchor);
  return { start, end };
}
