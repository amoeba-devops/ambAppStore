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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <section className="min-w-0">
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
         *   - Mobile / tablet (< lg): natural height, stacks below the
         *     calendar; TripsListPanel caps its inner list so the whole
         *     page doesn't grow huge.
         *   - Desktop (lg+): locked to 728px to match the calendar card
         *     exactly, sticky so it follows when the surrounding page
         *     scrolls (e.g. when a long peek drawer or footer appears). */}
        <aside className="flex flex-col gap-3 lg:sticky lg:top-4 lg:h-[728px] lg:self-start">
          <VehicleLegend vehicles={vehicles} />
          <div className="min-h-0 lg:flex-1">
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
