'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Plus, X } from 'lucide-react';
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from '@car-v2/ui';
import { AddressAutocomplete } from '@/components/inputs/address-autocomplete';
import { MapPreview } from '@/components/inputs/map-preview';
import { formatActionError } from '@/lib/format-action-error';
import { createTripAction, updateTripAction } from '@/server/actions/trips/trip.actions';
import type { TripDetail } from '@/server/queries/trips.queries';

interface SelectOption {
  id: string;
  label: string;
}

type Mode = 'create' | 'edit';

interface TripFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: Mode;
  /** Required when mode === 'edit'. */
  trip?: TripDetail | null;
  /** Prefill when opened from a calendar slot click (create mode only). */
  prefill?: { scheduledAt?: Date; vehicleId?: string };
  passengers: SelectOption[];
  drivers: SelectOption[];
  vehicles: SelectOption[];
  currentUserId: string;
  /** Fires after a successful create or update — caller wires URL highlight. */
  onSuccess: (tripId: string) => void;
}

const STOPOVER_CAP = 10;
const DURATION_MIN_MINUTES = 5;
const DURATION_MAX_MINUTES = 1440;

const datetimeLocalString = (d: Date): string => {
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
};

export function TripFormDialog({
  open,
  onOpenChange,
  mode,
  trip,
  prefill,
  passengers,
  drivers,
  vehicles,
  currentUserId,
  onSuccess,
}: TripFormDialogProps) {
  const t = useTranslations('dashboard.form');
  const tErr = useTranslations();
  const [pending, startTransition] = useTransition();

  const [passengerId, setPassengerId] = useState(currentUserId);
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [stopovers, setStopovers] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState('');
  const [durationMin, setDurationMin] = useState('');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');

  /* Track whether the user has touched the form since the dialog opened —
   * we ask for confirmation before discarding their input on close. Reset
   * to false during hydrate so opening a fresh dialog doesn't trigger the
   * prompt before the user has done anything. */
  const [dirty, setDirty] = useState(false);
  const markDirty = useCallback(() => setDirty(true), []);

  /* Reset / hydrate form whenever the dialog opens or switches mode/trip.
   * Avoids stale state bleeding from a previous create into an edit. */
  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && trip) {
      setPassengerId(trip.trpPassengerId ?? currentUserId);
      setPickup(trip.trpPickupAddress);
      setDropoff(trip.trpDropoffAddress);
      /* Edit mode hydrates stopovers as a read-only display only — the server
       * `updateTripSchema` doesn't accept stopovers, so they're shown to give
       * the user context but the UI hides the add/remove controls below. */
      setStopovers(trip.stopovers?.map((s) => s.address) ?? []);
      setScheduledAt(datetimeLocalString(new Date(trip.trpScheduledAt)));
      setDurationMin(trip.trpDurationMinutes ? String(trip.trpDurationMinutes) : '');
      setPurpose(trip.trpPurpose ?? '');
      setNotes(trip.trpNotes ?? '');
      setDriverId(trip.trpDriverId ?? '');
      setVehicleId(trip.trpVehicleId ?? '');
    } else {
      setPassengerId(currentUserId);
      setPickup('');
      setDropoff('');
      setStopovers([]);
      setScheduledAt(prefill?.scheduledAt ? datetimeLocalString(prefill.scheduledAt) : '');
      setDurationMin('');
      setPurpose('');
      setNotes('');
      setDriverId('');
      setVehicleId(prefill?.vehicleId ?? '');
    }
    setDirty(false);
  }, [open, mode, trip, prefill?.scheduledAt, prefill?.vehicleId, currentUserId]);

  /* `onOpenChange` interceptor — Radix calls this for Esc / outside-click /
   * the built-in X button as well as our own Cancel button. If the user has
   * unsaved input we confirm before discarding; otherwise close as normal. */
  const attemptClose = useCallback(
    (next: boolean) => {
      if (next) {
        onOpenChange(true);
        return;
      }
      if (dirty && !window.confirm(t('discardConfirm'))) return;
      onOpenChange(false);
    },
    [dirty, onOpenChange, t],
  );

  const addStopover = () => {
    if (stopovers.length >= STOPOVER_CAP) return;
    setStopovers((s) => [...s, '']);
    markDirty();
  };
  const removeStopover = (i: number) => {
    setStopovers((s) => s.filter((_, idx) => idx !== i));
    markDirty();
  };
  const updateStopover = (i: number, value: string) => {
    setStopovers((s) => s.map((v, idx) => (idx === i ? value : v)));
    markDirty();
  };

  const onSubmit = () => {
    if (pending) return;
    if (!pickup.trim() || !dropoff.trim() || !scheduledAt) {
      toast.error(t('errMissing'), { description: t('errMissingDesc') });
      return;
    }
    if ((driverId && !vehicleId) || (!driverId && vehicleId)) {
      toast.error(t('errIncomplete'), { description: t('errIncompleteDesc') });
      return;
    }
    /* Mirror server-side `z.number().int().min(5).max(1440)` so users see a
     * friendly toast instead of the raw Zod issue list (CAR-E0001). Empty
     * input is still allowed — server treats undefined as "not set". */
    if (durationMin) {
      const n = Number(durationMin);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < DURATION_MIN_MINUTES || n > DURATION_MAX_MINUTES) {
        toast.error(t('errDurationRange', { min: DURATION_MIN_MINUTES, max: DURATION_MAX_MINUTES }));
        return;
      }
    }

    startTransition(async () => {
      const basePayload = {
        passenger_id: passengerId || undefined,
        pickup_address: pickup.trim(),
        dropoff_address: dropoff.trim(),
        scheduled_at: new Date(scheduledAt).toISOString(),
        duration_minutes: durationMin ? Number(durationMin) : undefined,
        purpose: purpose.trim() || undefined,
        notes: notes.trim() || undefined,
        driver_id: driverId || undefined,
        vehicle_id: vehicleId || undefined,
      };

      if (mode === 'create') {
        /* Only `createTripSchema` accepts stopovers — `updateTripSchema`
         * doesn't have the field, so we attach them on create only. */
        const cleanStops = stopovers.map((s) => s.trim()).filter(Boolean);
        const res = await createTripAction({
          ...basePayload,
          stopovers: cleanStops.length ? cleanStops : undefined,
        });
        if (res.success) {
          toast.success(t('successCreate', { ref: res.data.trpRef }));
          onOpenChange(false);
          onSuccess(res.data.trpId);
        } else {
          toast.error(t('errCreate'), { description: formatActionError(res.error, tErr) });
        }
      } else {
        if (!trip) return;
        const res = await updateTripAction(trip.trpId, basePayload);
        if (res.success) {
          toast.success(t('successUpdate', { ref: res.data.trpRef }));
          onOpenChange(false);
          onSuccess(res.data.trpId);
        } else {
          toast.error(t('errUpdate'), { description: formatActionError(res.error, tErr) });
        }
      }
    });
  };

  const title = mode === 'create'
    ? t('titleCreate')
    : t('titleEdit', { ref: trip?.trpRef ?? '' });
  const submitLabel = mode === 'create' ? t('submitCreate') : t('submitEdit');
  const fullFormHref = mode === 'edit' && trip
    ? `/trips/${trip.trpId}/edit`
    : '/trips/new';
  const fullFormLabel = mode === 'edit' ? t('fullFormEdit') : t('fullFormCreate');

  /* Visible stopovers in the map preview — trimmed + non-empty so the embed
   * URL doesn't generate stray "/" segments. Always shown (both create and
   * edit modes) so the user gets visual confirmation of the route they're
   * looking at, even when the inputs themselves aren't editable on edit. */
  const mapStopovers = stopovers.map((s) => s.trim()).filter(Boolean);

  /* Show the stopover editor only in create mode — `updateTripSchema` doesn't
   * accept stopovers, so letting the user "edit" them would be a lie. */
  const canEditStopovers = mode === 'create';

  return (
    <Dialog open={open} onOpenChange={attemptClose}>
      {/* Mobile (< md): full-screen sheet — covers the whole viewport with
       *   sticky header (title) and sticky footer (Cancel + Submit) so the
       *   submit button stays in the thumb zone even on long forms. The
       *   intermediate form grid scrolls between them via `flex-1 overflow-y-auto`.
       *
       * Desktop (>= md): centered modal as before, max 3xl/5xl wide, with
       *   the sticky right-rail map preview.
       *
       * `onPointerDownOutside` + `onEscapeKeyDown` defer to the close path so
       * the discard-confirm runs for these too, not just the X / Cancel. */}
      <DialogContent
        size="xl"
        className={cn(
          /* Layout: stack header / scrollable grid / footer with flex. */
          'flex flex-col gap-0 p-0',
          /* Mobile: full-screen, edge-to-edge, no rounded corners. */
          'inset-0 left-0 top-0 translate-x-0 translate-y-0 w-screen h-[100dvh] max-h-[100dvh] max-w-none rounded-none border-0',
          /* Desktop: centered modal, original sizing + spacing. */
          'md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:h-auto md:max-h-[90vh] md:w-[calc(100vw-1rem)] md:max-w-3xl md:rounded-lg md:border md:gap-4',
          'lg:max-w-5xl',
        )}
        onPointerDownOutside={(e) => {
          if (dirty) {
            e.preventDefault();
            attemptClose(false);
          }
        }}
        onEscapeKeyDown={(e) => {
          if (dirty) {
            e.preventDefault();
            attemptClose(false);
          }
        }}
        /* Mobile keyboard would pop up immediately and cover the dialog
         * if Radix auto-focused the first input. The form has 7+ fields;
         * the user knows which one they want to start with — let them
         * tap, not us. Desktop suffers no harm since keyboards there
         * don't overlay viewport. */
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Sticky title bar on mobile so the user always knows which form
         * they're in while scrolling a long screen. Desktop drops the
         * sticky + border so it reads as a normal dialog title. */}
        <DialogHeader className="sticky top-0 z-10 shrink-0 border-b border-border bg-surface px-4 py-3 md:static md:border-0 md:bg-transparent md:px-6 md:py-4">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 md:overflow-visible md:px-6 md:py-0 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,400px)]">
          {/* ── LEFT: form fields ─────────────────────────────────────── */}
          <div className="space-y-3 min-w-0">
            {passengers.length > 0 && (
              <div className="space-y-1">
                <Label htmlFor="tfd-passenger">{t('passenger')}</Label>
                <Select value={passengerId} onValueChange={(v) => { setPassengerId(v); markDirty(); }}>
                  <SelectTrigger id="tfd-passenger">
                    <SelectValue placeholder={t('passengerPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {passengers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label>{t('pickup')}</Label>
              <AddressAutocomplete
                value={pickup}
                onChange={(v) => { setPickup(v); markDirty(); }}
                placeholder={t('pickupPlaceholder')}
              />
            </div>

            <div className="space-y-1">
              <Label>{t('dropoff')}</Label>
              <AddressAutocomplete
                value={dropoff}
                onChange={(v) => { setDropoff(v); markDirty(); }}
                placeholder={t('dropoffPlaceholder')}
              />
            </div>

            {/* Stopovers — list + add button only in create mode. */}
            {canEditStopovers && (
              <div className="space-y-2">
                {stopovers.length > 0 && (
                  <ul className="space-y-1.5">
                    {stopovers.map((s, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <AddressAutocomplete
                            value={s}
                            onChange={(val) => updateStopover(i, val)}
                            placeholder={t('stopPlaceholder', { n: i + 1 })}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t('removeStopAria')}
                          onClick={() => removeStopover(i)}
                        >
                          <X />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                {stopovers.length < STOPOVER_CAP && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    iconLeft={<Plus />}
                    onClick={addStopover}
                    className="h-7 px-2 text-xs"
                  >
                    {t('addStop')}
                    {stopovers.length > 0 ? ` (${stopovers.length}/${STOPOVER_CAP})` : ''}
                  </Button>
                )}
              </div>
            )}

            {/* On mobile, surface the map between route + time so the user
             * gets visual confirmation right after typing the addresses.
             * Hidden on desktop where the sticky right column owns it. */}
            <div className="lg:hidden">
              <MapPreview
                pickup={pickup}
                dropoff={dropoff}
                stopovers={mapStopovers}
                heightClassName="h-[200px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="tfd-when">{t('scheduledAt')}</Label>
                <Input
                  id="tfd-when"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => { setScheduledAt(e.target.value); markDirty(); }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tfd-duration">{t('duration')}</Label>
                <Input
                  id="tfd-duration"
                  type="number"
                  min={DURATION_MIN_MINUTES}
                  max={DURATION_MAX_MINUTES}
                  value={durationMin}
                  placeholder={t('durationPlaceholder')}
                  onChange={(e) => { setDurationMin(e.target.value); markDirty(); }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="tfd-vehicle">{t('vehicle')}</Label>
                <Select value={vehicleId} onValueChange={(v) => { setVehicleId(v); markDirty(); }}>
                  <SelectTrigger id="tfd-vehicle">
                    <SelectValue placeholder={t('vehiclePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="tfd-driver">{t('driver')}</Label>
                <Select value={driverId} onValueChange={(v) => { setDriverId(v); markDirty(); }}>
                  <SelectTrigger id="tfd-driver">
                    <SelectValue placeholder={t('driverPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="tfd-purpose">{t('purpose')}</Label>
              <Input
                id="tfd-purpose"
                value={purpose}
                placeholder={t('purposePlaceholder')}
                maxLength={255}
                onChange={(e) => { setPurpose(e.target.value); markDirty(); }}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="tfd-notes">{t('notes')}</Label>
              <Textarea
                id="tfd-notes"
                rows={2}
                value={notes}
                placeholder={t('notesPlaceholder')}
                maxLength={2000}
                onChange={(e) => { setNotes(e.target.value); markDirty(); }}
              />
            </div>
          </div>

          {/* ── RIGHT: sticky map preview (desktop only) ──────────────── */}
          <aside className="hidden lg:block">
            <div className="sticky top-0">
              <MapPreview
                pickup={pickup}
                dropoff={dropoff}
                stopovers={mapStopovers}
                heightClassName="h-[420px]"
              />
            </div>
          </aside>
        </div>

        {/* Sticky bottom action bar on mobile — keeps Cancel + Submit in
         * the thumb zone (with safe-area inset for iOS home-indicator) so
         * the user doesn't have to scroll the form to find them. Buttons
         * split full-width on mobile, right-align on desktop. */}
        <DialogFooter className={cn(
          'sticky bottom-0 z-10 shrink-0 gap-2 border-t border-border bg-surface px-4 py-3',
          'pb-[max(env(safe-area-inset-bottom),12px)]',
          /* Mobile: stack vertically, Submit on top, Cancel underneath. */
          'flex flex-col-reverse',
          /* Desktop: revert to inline row, right-align, drop sticky/border. */
          'md:static md:flex-row md:justify-end md:border-0 md:bg-transparent md:px-6 md:py-4',
        )}>
          <Link
            href={fullFormHref}
            className="self-start text-[11px] text-text-muted hover:text-text md:mr-auto md:self-center"
          >
            {fullFormLabel}
          </Link>
          <Button type="button" variant="ghost" size="md" onClick={() => attemptClose(false)} disabled={pending} className="md:w-auto">
            {t('cancel')}
          </Button>
          <Button type="button" variant="accent" size="md" onClick={onSubmit} disabled={pending} className="md:w-auto">
            {pending ? '…' : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
