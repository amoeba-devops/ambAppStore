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
import { formatActionError } from '@/lib/format-action-error';
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

/* SSR-safe defaults. The previous `useState(loadSubView)` /
 * `useState(loadColorMode)` initializers read localStorage during render,
 * which produced different values on server (window === undefined → fall
 * back to 'month'/'vehicle') vs client (whatever the user previously
 * picked), causing hydration mismatches on every conditional-class button
 * in the calendar toolbar. We now seed with the same default on both
 * sides and adopt the persisted value in a post-mount effect — at worst
 * the user sees a one-frame flicker of the default view before their
 * saved preference snaps in. */
const DEFAULT_VIEW: CalendarViewType = 'month';
const DEFAULT_COLOR_MODE: CalendarColorMode = 'vehicle';

function loadSubView(): CalendarViewType {
  if (typeof window === 'undefined') return DEFAULT_VIEW;
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
  if (typeof window === 'undefined') return DEFAULT_COLOR_MODE;
  const v = window.localStorage.getItem(COLOR_MODE_KEY);
  return v === 'status' ? 'status' : DEFAULT_COLOR_MODE;
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
  const tErr = useTranslations();
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  /* Seed with SSR-safe defaults; the post-mount effect below adopts the
   * persisted localStorage value. Keeps server + client first paint
   * identical → no hydration mismatch on the toolbar's view picker /
   * color-mode segmented control. */
  const [view, setView] = useState<CalendarViewType>(DEFAULT_VIEW);
  const [colorMode, setColorMode] = useState<CalendarColorMode>(DEFAULT_COLOR_MODE);
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

  /* Post-mount: pull persisted view + color-mode out of localStorage and
   * adopt them. Done in an effect (not as the useState initializer) so
   * SSR + client first paint render with the same default values — the
   * hydration check passes, and the persisted preference snaps in one
   * frame later. The matching save-effects below run once with the
   * default before this load fires, briefly overwriting the persisted
   * value, but the very next render (triggered by the setState here)
   * re-saves the correct value, so localStorage ends consistent. */
  useEffect(() => {
    setView(loadSubView());
    setColorMode(loadColorMode());
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
        toast.error(formatActionError(res.error, tErr));
      }
    });
  }, [anchor, view, rangeFilter, t, tErr]);

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
        toast.error(t('dragError'), { description: formatActionError(res.error, tErr) });
      }
    },
    [events, t, tErr, router],
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

  /* Card height strategy (desktop, lg+):
   *   `lg:h-[900px]` is the IDEAL target — matches the time-grid's
   *   intrinsic (toolbar ~80 + 17 hours × 44 + day header ≈ 900px) so
   *   that view fits without scroll, and other views fit-or-internally-
   *   scroll inside the same pinned card.
   *   `lg:max-h-[var(--ccms-dash-h,calc(100dvh-180px))]` caps that to
   *   whatever vertical space is actually available below the page
   *   chrome. The CSS variable is set by DashboardShell's ResizeObserver
   *   from the page wrapper's real clientHeight, so it automatically
   *   accounts for the PushPromptStrip appearing or disappearing in
   *   <main>. Fallback `calc(100dvh-180px)` covers SSR / first paint
   *   before the effect runs. */
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface lg:flex lg:flex-col lg:h-[900px] lg:max-h-[var(--ccms-dash-h,calc(100dvh-180px))]">
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
      {/* Calendar viewport.
       *   - Mobile: fits within remaining viewport space (subtract page
       *     header + breadcrumbs + tab nav + toolbar + buffer). Inner
       *     content scrolls both axes inside this box.
       *   - Desktop: `flex-1` fills the remaining height of the fixed-
       *     dimension calendar card (set above on the wrapper). Because
       *     the CARD height is pinned (not the viewport itself), the
       *     toolbar above stays anchored exactly where it is on every
       *     view switch — no reflow, no jump. The viewport absorbs the
       *     view-to-view content-size delta (gantt ~180px vs time-grid
       *     ~806px) internally via `overflow-auto`. */}
      <div
        className={cn(
          'h-[calc(100dvh-260px)] min-h-[420px] overflow-auto lg:h-auto lg:flex-1 lg:min-h-0 lg:overflow-auto',
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
