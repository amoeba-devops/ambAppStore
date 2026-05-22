'use client';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { cn } from '@car-v2/ui';
import {
  fetchTripsForCalendarAction,
  updateTripAction,
} from '@/server/actions/trips/trip.actions';
import type { TripListItem } from '@/server/queries/trips.queries';
import type { LocalRole } from '@car-v2/shared/auth';
import { CalendarToolbar } from './calendar/toolbar';
import { CalendarMonthView } from './calendar/month-view';
import { CalendarTimeGridView } from './calendar/time-grid-view';
import { CalendarGanttView } from './calendar/gantt-view';
import { moveAnchor, rangeForView, tripToCalendarEvent } from './calendar/utils';
import { canDragTrip } from './calendar/permission';
import type {
  CalendarColorMode,
  CalendarEvent,
  CalendarRangeFilter,
  CalendarVehicle,
  CalendarViewType,
} from './calendar/types';

const SUB_VIEW_KEY = 'dashboard.calendar.subView';
const COLOR_MODE_KEY = 'dashboard.calendar.colorMode';
const HIGHLIGHT_CLEAR_MS = 3000;

function loadSubView(): CalendarViewType {
  if (typeof window === 'undefined') return 'month';
  const v = window.localStorage.getItem(SUB_VIEW_KEY);
  if (v === 'month' || v === 'week' || v === 'day' || v === 'gantt') return v;
  /* No saved preference yet — Month grid (7 cols × 6 rows) is unusable on a
   * ~360px mobile width because each event chip becomes a slim sliver, so we
   * land first-time mobile visitors on Day view instead. Desktop keeps the
   * familiar Month overview. The user can still switch + we persist whatever
   * they pick. */
  return window.matchMedia('(min-width: 768px)').matches ? 'month' : 'day';
}

function loadColorMode(): CalendarColorMode {
  if (typeof window === 'undefined') return 'vehicle';
  const v = window.localStorage.getItem(COLOR_MODE_KEY);
  return v === 'status' ? 'status' : 'vehicle';
}

interface DashboardViewProps {
  initialTrips: TripListItem[];
  vehicles: CalendarVehicle[];
  currentUser: { role: LocalRole; userId: string };
  /** Highlighted trip id (from URL `?highlight=<id>`). Animates the matching
   * event chip + auto-jumps anchor if the trip is outside the current view. */
  highlightId?: string | null;
  /** Click empty calendar slot → parent opens TripFormDialog with prefill. */
  onSlotCreate: (when: Date, vehicleId: string | null) => void;
}

export function DashboardView({
  initialTrips,
  vehicles,
  currentUser,
  highlightId,
  onSlotCreate,
}: DashboardViewProps) {
  const router = useRouter();
  const t = useTranslations('dashboard.calendar');
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [view, setView] = useState<CalendarViewType>(loadSubView);
  const [colorMode, setColorMode] = useState<CalendarColorMode>(loadColorMode);
  const [trips, setTrips] = useState<TripListItem[]>(initialTrips);
  const [isFetching, startFetch] = useTransition();
  /* When the user picks a custom date range via the toolbar's range popover,
   * we override the view's natural range for fetching and badge display.
   * `null` = no custom override; toolbar's quick chips don't store state
   * here — they're derived from (view, anchor). Any normal navigation
   * (prev/next/view change) clears the custom range. */
  const [rangeFilter, setRangeFilter] = useState<CalendarRangeFilter | null>(null);
  const [touchDevice, setTouchDevice] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setTouchDevice(window.matchMedia('(pointer: coarse)').matches);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SUB_VIEW_KEY, view);
    }
  }, [view]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(COLOR_MODE_KEY, colorMode);
    }
  }, [colorMode]);

  /* Trips state mirrors server fetch — when the parent (page.tsx) refreshes
   * after a create/edit/drag, the prop `initialTrips` changes and we resync.
   * Without this, the calendar stays stale until the user navigates view. */
  useEffect(() => {
    setTrips(initialTrips);
  }, [initialTrips]);

  /* Auto-anchor jump: when `?highlight=<id>` is set, ensure the trip is on
   * screen. If its scheduledAt falls outside the current view's range, set
   * the anchor to the trip's date. Runs once per highlight change. */
  const jumpedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!highlightId || jumpedRef.current === highlightId) return;
    const tr = trips.find((x) => x.trpId === highlightId);
    if (!tr) return;
    const tripDate = new Date(tr.trpScheduledAt);
    const range = rangeForView(anchor, view);
    if (tripDate < range.start || tripDate >= range.end) {
      setAnchor(tripDate);
    }
    jumpedRef.current = highlightId;
  }, [highlightId, trips, anchor, view]);

  /* Strip ?highlight from the URL after the pulse animation completes so a
   * refresh doesn't re-animate stale state. `router.replace` (not push) means
   * the back button doesn't accumulate dead entries. */
  useEffect(() => {
    if (!highlightId) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      params.delete('highlight');
      const qs = params.toString();
      router.replace(qs ? `/dashboard?${qs}` : '/dashboard', { scroll: false });
    }, HIGHLIGHT_CLEAR_MS);
    return () => clearTimeout(timer);
  }, [highlightId, router]);

  /* Refetch when anchor/view/customRange changes (skip on first mount —
   * initialTrips already covers the default month). A custom range overrides
   * the view's natural range so the user sees exactly what they picked. */
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const range = rangeFilter?.kind === 'custom'
      ? { start: rangeFilter.start, end: rangeFilter.end }
      : rangeForView(anchor, view);
    startFetch(async () => {
      const res = await fetchTripsForCalendarAction({
        range_start: range.start.toISOString(),
        range_end: range.end.toISOString(),
      });
      if (res.success) {
        setTrips(res.data);
      } else if (res.error.code === 'CAR-E0413') {
        toast.error(t('rangeTooLarge'));
      } else {
        toast.error(res.error.message);
      }
    });
  }, [anchor, view, rangeFilter, t]);

  const events = useMemo<CalendarEvent[]>(() => trips.map(tripToCalendarEvent), [trips]);

  const draggableIds = useMemo(() => {
    if (touchDevice) return new Set<string>();
    const ids = new Set<string>();
    for (const ev of events) {
      if (canDragTrip(currentUser.role, currentUser.userId, ev)) ids.add(ev.id);
    }
    return ids;
  }, [events, currentUser, touchDevice]);

  const handleEventClick = useCallback(
    (eventId: string) => {
      const params = new URLSearchParams(window.location.search);
      params.set('peek', eventId);
      router.push(`/dashboard?${params.toString()}`, { scroll: false });
    },
    [router],
  );

  const handleMoreClick = useCallback((day: Date) => {
    setAnchor(day);
    setView('day');
  }, []);

  const handleEventDrop = useCallback(
    async (eventId: string, newStart: Date) => {
      const ev = events.find((x) => x.id === eventId);
      if (!ev) return;
      if (newStart.getTime() === ev.start.getTime()) return;

      const oldStart = ev.start;

      setTrips((prev) =>
        prev.map((tr) => (tr.trpId === eventId ? { ...tr, trpScheduledAt: newStart } : tr)),
      );

      const res = await updateTripAction(eventId, { scheduled_at: newStart.toISOString() });
      if (res.success) {
        toast.success(t('rescheduled', { ref: ev.ref }));
        /* Server-side data may now differ (e.g. trip moved out of today's
         * IN_USE window → VehicleLegend count) — refresh to resync. */
        router.refresh();
      } else {
        setTrips((prev) =>
          prev.map((tr) => (tr.trpId === eventId ? { ...tr, trpScheduledAt: oldStart } : tr)),
        );
        toast.error(t('dragError'), { description: res.error.message });
      }
    },
    [events, t, router],
  );

  /* Navigation handlers — any of these implies the user is moving away from
   * a custom-range view, so we drop the custom filter to avoid stranding the
   * fetch on the old explicit range. Quick filter chips also clear because
   * they set a new (view, anchor) combo directly. */
  const handlePrev = useCallback(() => {
    setRangeFilter(null);
    setAnchor((a) => moveAnchor(a, view, -1));
  }, [view]);
  const handleNext = useCallback(() => {
    setRangeFilter(null);
    setAnchor((a) => moveAnchor(a, view, 1));
  }, [view]);
  const handleViewChange = useCallback((v: CalendarViewType) => {
    setRangeFilter(null);
    setView(v);
  }, []);
  const handleQuickFilter = useCallback((kind: 'today' | 'this-week' | 'this-month') => {
    setRangeFilter(null);
    const today = new Date();
    setAnchor(today);
    if (kind === 'today') setView('day');
    else if (kind === 'this-week') setView('week');
    else setView('month');
  }, []);
  const handleCustomRange = useCallback((start: Date, end: Date) => {
    setRangeFilter({ kind: 'custom', start, end });
    /* Pick a view that best frames the picked span so the user immediately
     * sees their range without manual fiddling. Day for ≤1 day, Week for
     * 2–7 days, Month for longer. Anchor goes to the start of the range. */
    const days = Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
    setAnchor(start);
    if (days <= 1) setView('day');
    else if (days <= 7) setView('week');
    else setView('month');
  }, []);
  const handleClearFilter = useCallback(() => {
    setRangeFilter(null);
    setAnchor(new Date());
    setView('month');
  }, []);

  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      <CalendarToolbar
        anchor={anchor}
        view={view}
        onView={handleViewChange}
        onPrev={handlePrev}
        onNext={handleNext}
        colorMode={colorMode}
        onColorMode={setColorMode}
        rangeFilter={rangeFilter}
        onQuickFilter={handleQuickFilter}
        onCustomRange={handleCustomRange}
        onClearFilter={handleClearFilter}
      />
      {/* Calendar viewport. Mobile fits within remaining viewport space
       * (subtract page header + breadcrumbs + tab nav + toolbar + buffer);
       * desktop locks at 680px so switching sub-views never reflows the page.
       * Inner content scrolls both axes inside this box. */}
      <div
        className={cn(
          'h-[calc(100dvh-260px)] min-h-[420px] overflow-auto md:h-[680px]',
          isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity',
        )}
      >
        {view === 'month' && (
          <CalendarMonthView
            anchor={anchor}
            events={events}
            draggableIds={draggableIds}
            colorMode={colorMode}
            highlightId={highlightId}
            onEventClick={handleEventClick}
            onSlotClick={(d) => onSlotCreate(d, null)}
            onEventDrop={handleEventDrop}
            onMoreClick={handleMoreClick}
          />
        )}
        {view === 'week' && (
          <CalendarTimeGridView
            anchor={anchor}
            events={events}
            dayCount={7}
            draggableIds={draggableIds}
            colorMode={colorMode}
            highlightId={highlightId}
            onEventClick={handleEventClick}
            onSlotClick={(w) => onSlotCreate(w, null)}
            onEventDrop={handleEventDrop}
          />
        )}
        {view === 'day' && (
          <CalendarTimeGridView
            anchor={anchor}
            events={events}
            dayCount={1}
            draggableIds={draggableIds}
            colorMode={colorMode}
            highlightId={highlightId}
            onEventClick={handleEventClick}
            onSlotClick={(w) => onSlotCreate(w, null)}
            onEventDrop={handleEventDrop}
          />
        )}
        {view === 'gantt' && (
          <CalendarGanttView
            anchor={anchor}
            events={events}
            vehicles={vehicles}
            draggableIds={draggableIds}
            colorMode={colorMode}
            highlightId={highlightId}
            onEventClick={handleEventClick}
            onSlotClick={(w, vId) => onSlotCreate(w, vId)}
            onEventDrop={handleEventDrop}
          />
        )}
      </div>
    </div>
  );
}
