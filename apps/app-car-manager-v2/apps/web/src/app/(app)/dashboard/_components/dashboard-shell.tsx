'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { TripDetail, TripListItem } from '@/server/queries/trips.queries';
import type { CarVehicleStatus } from '@car-v2/db/schema';
import type { LocalRole } from '@car-v2/shared/auth';
import { TripPeekDrawer } from '../../trips/_components/trip-peek-drawer';
import { DashboardView } from './dashboard-view';
import { TripFormDialog } from './trip-form-dialog';
import { TripsListPanel } from './trips-list-panel';
import { VehicleLegend } from './vehicle-legend';

interface PeekContext {
  trip: TripDetail;
  drivers: Array<{ id: string; label: string }>;
  vehicles: Array<{ id: string; label: string }>;
  isCreator: boolean;
}

interface DashboardShellProps {
  initialTrips: TripListItem[];
  recentTrips: TripListItem[];
  vehicles: Array<{
    id: string;
    plate: string;
    status: CarVehicleStatus;
    activeTripCount: number;
  }>;
  passengers: Array<{ id: string; label: string }>;
  drivers: Array<{ id: string; label: string }>;
  vehicleOptions: Array<{ id: string; label: string }>;
  currentUser: { role: LocalRole; userId: string };
  highlightId?: string | null;
  /** When true (from URL `?create=1`), shell opens the dialog on mount. The
   * cross-boundary signal lets the Server PageHeader's "+ Create" button
   * trigger the Client-owned dialog without React Context. */
  createSignal?: boolean;
  peek?: PeekContext | null;
}

interface DialogState {
  open: boolean;
  mode: 'create' | 'edit';
  trip?: TripDetail | null;
  prefill?: { scheduledAt?: Date; vehicleId?: string };
}

/**
 * Client-owned dashboard surface. PageHeader stays in the parent Server
 * Component (so async Breadcrumbs + getTranslations work); the "+ Create"
 * button in the header pushes `?create=1` and we react here via the
 * `createSignal` prop. Peek drawer + dialog live inside this shell so the
 * drawer's "Edit" button can switch into the dialog directly.
 */
export function DashboardShell({
  initialTrips,
  recentTrips,
  vehicles,
  passengers,
  drivers,
  vehicleOptions,
  currentUser,
  highlightId,
  createSignal,
  peek,
}: DashboardShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dialog, setDialog] = useState<DialogState>({ open: false, mode: 'create' });

  /* Dynamic available-height for the calendar card. PushPromptStrip can
   * appear/disappear inside <main> (when the user enables Web Push or
   * snoozes the prompt), which changes the page wrapper's clientHeight.
   * A hardcoded `calc(100dvh - 180px)` doesn't track that — it under-
   * subtracts when the strip is up and the dashboard overflows the
   * viewport. ResizeObserver on both the page wrapper AND <main> fires
   * on strip show/hide AND on viewport resize, so the variable always
   * reflects the real available band. The calendar card consumes it via
   * `lg:max-h-[var(--ccms-dash-h,calc(100dvh-180px))]` — fallback to the
   * static calc keeps SSR / first paint correct. */
  const gridRef = useRef<HTMLDivElement>(null);
  const [availableHeight, setAvailableHeight] = useState<number | null>(null);

  useEffect(() => {
    const gridEl = gridRef.current;
    const pageWrapper = gridEl?.parentElement;
    if (!gridEl || !pageWrapper) return;

    const recompute = () => {
      const style = getComputedStyle(pageWrapper);
      const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const usable = pageWrapper.clientHeight - padY;
      if (usable > 0) setAvailableHeight(usable);
    };

    const observer = new ResizeObserver(recompute);
    observer.observe(pageWrapper);
    /* <main> hosts PushPromptStrip — observing it fires the recompute
     * when the strip mounts/unmounts (its presence changes <main>'s
     * scrollHeight even when window size is unchanged). */
    const mainEl = pageWrapper.closest('main');
    if (mainEl) observer.observe(mainEl);

    recompute();
    return () => observer.disconnect();
  }, []);

  const calendarVehicles = vehicles.map((v) => ({ id: v.id, plate: v.plate }));

  const stripCreateParam = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('create');
    const qs = params.toString();
    router.replace(qs ? `/dashboard?${qs}` : '/dashboard', { scroll: false });
  };

  const openCreate = (prefill?: DialogState['prefill']) =>
    setDialog({ open: true, mode: 'create', trip: null, prefill });
  const openEdit = (trip: TripDetail) =>
    setDialog({ open: true, mode: 'edit', trip, prefill: undefined });
  const closeDialog = () => {
    setDialog((d) => ({ ...d, open: false }));
    /* If the dialog was opened via `?create=1` from the PageHeader button, the
     * param needs cleaning so reload / back doesn't re-open. Safe to call
     * even when the param isn't set — URLSearchParams.delete is idempotent. */
    if (searchParams.get('create')) stripCreateParam();
  };

  /* Open the create dialog when the URL signal flips on. `seenSignalRef`
   * suppresses re-opens caused by unrelated re-renders — the trigger should
   * fire exactly once per ?create=1 navigation. */
  const seenSignalRef = useRef<boolean>(false);
  useEffect(() => {
    if (!createSignal) {
      seenSignalRef.current = false;
      return;
    }
    if (seenSignalRef.current) return;
    seenSignalRef.current = true;
    openCreate();
  }, [createSignal]);

  /* Post-success: push `?highlight=<id>` so the calendar pulses the chip +
   * side panel scrolls to the row, then `router.refresh()` re-fetches server
   * data (recentTrips, vehicles, calendar range) so the new/updated entry
   * actually renders. The highlight URL is cleared by dashboard-view.tsx
   * after a 3s timeout. */
  const handleSuccess = (tripId: string) => {
    router.push(`/dashboard?highlight=${tripId}`, { scroll: false });
    router.refresh();
  };

  return (
    <>
      <div
        ref={gridRef}
        className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px] lg:items-stretch"
        style={
          availableHeight
            ? ({ '--ccms-dash-h': `${availableHeight}px` } as React.CSSProperties)
            : undefined
        }
      >
        <section className="min-w-0 lg:flex lg:flex-col">
          <DashboardView
            initialTrips={initialTrips}
            vehicles={calendarVehicles}
            currentUser={currentUser}
            highlightId={highlightId}
            onSlotCreate={(when, vehicleId) =>
              openCreate({ scheduledAt: when, vehicleId: vehicleId ?? undefined })
            }
          />
        </section>
        {/* Right rail behaviour by breakpoint:
         *   - Mobile / tablet (< lg): natural flex-col stacking with gap.
         *     TripsListPanel caps its inner list so the page doesn't grow
         *     to N×row height when the tenant has many trips.
         *   - Desktop (lg+): the aside is `block relative` and the inner
         *     wrapper is positioned absolutely. This pulls the rail content
         *     OUT OF FLOW so the aside contributes ZERO intrinsic height
         *     to the grid row calculation — otherwise `items-stretch`
         *     would size the row to the rail's max-content (VehicleLegend
         *     + full trips list), which both stretches the calendar
         *     (empty band below the last hour row) AND lets the trips
         *     list extend past the calendar's bottom. With aside=0
         *     intrinsic, the grid row matches the calendar's natural
         *     height, the aside is stretched to that same height via
         *     items-stretch, and the absolute wrapper fills it with
         *     VehicleLegend on top + TripsListPanel flex-growing
         *     internally. Trips overflow scrolls inside the panel. */}
        <aside className="flex flex-col gap-3 lg:block lg:relative">
          <div className="contents lg:absolute lg:inset-0 lg:flex lg:flex-col lg:gap-3">
            <VehicleLegend vehicles={vehicles} />
            <TripsListPanel
              trips={recentTrips}
              highlightId={highlightId}
              onCreateClick={() => openCreate()}
            />
          </div>
        </aside>
      </div>

      <TripFormDialog
        open={dialog.open}
        onOpenChange={(o) => (o ? null : closeDialog())}
        mode={dialog.mode}
        trip={dialog.trip}
        prefill={dialog.prefill}
        passengers={passengers}
        drivers={drivers}
        vehicles={vehicleOptions}
        currentUserId={currentUser.userId}
        onSuccess={handleSuccess}
      />

      {peek && (
        <TripPeekDrawer
          trip={peek.trip}
          role={currentUser.role}
          isAssignedDriver={false}
          isCreator={peek.isCreator}
          drivers={peek.drivers}
          vehicles={peek.vehicles}
          onEdit={openEdit}
        />
      )}
    </>
  );
}
