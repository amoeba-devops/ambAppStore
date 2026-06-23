'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, Save } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardHeaderText,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  toast,
} from '@car-v2/ui';
import type { LocalRole } from '@car-v2/shared/auth';
import { createTruckTripAction, updateTruckTripAction } from '@/server/actions/trips/truck-trip.actions';
import { formatActionError } from '@/lib/format-action-error';
import { StopBuilder, makeDefaultStops, type StopField } from './stop-builder';
import type { CarTripStopover } from '@car-v2/db/schema';

export interface OptionItem {
  id: string;
  label: string;
}

export type TruckTripFormInitial = Partial<{
  scheduledAt: string;
  vehicleId: string;
  driverId: string;
  customer: string;
  pickup: string;
  dropoff: string;
  bol: string;
  cdf: string;
  revenue: string;
  fuelPrice: string;
  startOdo: string;
  endOdo: string;
  fuelLiters: string;
  toll: string;
  otherAmount: string;
  otherNote: string;
  markCompleted: boolean;
  stopovers: CarTripStopover[];
}>;

const todayIso = () => new Date().toISOString().slice(0, 10);

const EMPTY_FIELDS = {
  scheduledAt: todayIso(),
  vehicleId: '',
  driverId: '',
  customer: '',
  bol: '',
  cdf: '',
  revenue: '',
  fuelPrice: '',
  startOdo: '',
  endOdo: '',
  fuelLiters: '',
  toll: '',
  otherAmount: '',
  otherNote: '',
};

const numF = (s: string) => (s.trim() === '' ? undefined : Number(s));
const numI = (s: string) => (s.trim() === '' ? undefined : Math.trunc(Number(s)));
const vnd = (n: number) => n.toLocaleString('vi-VN') + ' ₫';

/** Convert saved stopovers from DB into the form's StopField[] state. */
function stopoversToFields(stopovers: CarTripStopover[]): StopField[] {
  return stopovers
    .slice()
    .sort((a, b) => a.tstOrder - b.tstOrder)
    .map((s) => ({
      id: s.tstId,
      type: s.tstType,
      address: s.tstAddress,
      km: s.tstKm != null ? String(s.tstKm) : '',
    }));
}

export function TruckTripForm({
  vehicles,
  drivers,
  role,
  depotAddress,
  tripId,
  initial,
}: {
  vehicles: OptionItem[];
  drivers: OptionItem[];
  /** Caller's role — DRIVER hides revenue and locks the driver field to self. */
  role?: LocalRole;
  /** Default depot address to pre-fill ORIGIN / RETURN stops. */
  depotAddress?: string | null;
  tripId?: string;
  initial?: TruckTripFormInitial;
}) {
  const t = useTranslations('screens.truckTrips.form');
  const tErr = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState({ ...EMPTY_FIELDS, ...initial });
  const [markCompleted, setMarkCompleted] = useState(initial?.markCompleted ?? true);

  /* Stop builder state — initialised from saved stopovers or depot defaults. */
  const [stops, setStops] = useState<StopField[]>(() => {
    if (initial?.stopovers && initial.stopovers.length > 0) {
      return stopoversToFields(initial.stopovers);
    }
    return makeDefaultStops(depotAddress);
  });

  const isDriver = role === 'DRIVER';

  const set =
    (k: keyof typeof EMPTY_FIELDS) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setF((s) => ({ ...s, [k]: e.target.value }));

  /* Live profit preview. */
  const preview = useMemo(() => {
    const fuelCost = Math.round((numF(f.fuelLiters) ?? 0) * (numF(f.fuelPrice) ?? 0));
    const toll = Math.round(numF(f.toll) ?? 0);
    const other = Math.round(numF(f.otherAmount) ?? 0);
    const revenue = Math.round(numF(f.revenue) ?? 0);
    const totalCost = fuelCost + toll + other;
    return { fuelCost, totalCost, profit: revenue - totalCost };
  }, [f.fuelLiters, f.fuelPrice, f.toll, f.otherAmount, f.revenue]);

  /* Extract pickup/dropoff from stops for the API (summary + notification). */
  const pickupStop = stops.find((s) => s.type === 'PICKUP');
  const dropoffStop = stops.find((s) => s.type === 'DELIVERY');
  const pickupAddress = pickupStop?.address.trim() ?? '';
  const dropoffAddress = dropoffStop?.address.trim() ?? '';

  const stopsValid =
    pickupAddress !== '' &&
    dropoffAddress !== '' &&
    stops.filter((s) => s.type === 'WAYPOINT').every((s) => s.address.trim() !== '');

  const dirty = f.vehicleId !== '' && (isDriver || f.driverId !== '') && stopsValid;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    startTransition(async () => {
      const stopoversPayload = stops
        .filter((s) => s.address.trim() !== '' || s.type === 'PICKUP' || s.type === 'DELIVERY')
        .map((s) => ({
          type: s.type,
          address: s.address.trim(),
          km: s.km ? Number(s.km) : undefined,
        }));

      const payload = {
        scheduled_at: f.scheduledAt,
        vehicle_id: f.vehicleId || undefined,
        driver_id: isDriver ? undefined : (f.driverId || undefined),
        customer: f.customer.trim() || undefined,
        pickup_address: pickupAddress,
        dropoff_address: dropoffAddress,
        bol: f.bol.trim() || undefined,
        cdf: f.cdf.trim() || undefined,
        fuel_price: numF(f.fuelPrice),
        revenue: isDriver ? undefined : numF(f.revenue),
        mark_completed: isDriver ? false : markCompleted,
        start_odometer: numI(f.startOdo),
        end_odometer: numI(f.endOdo),
        fuel_liters: numF(f.fuelLiters),
        toll_fee: numF(f.toll),
        other_amount: isDriver ? undefined : numF(f.otherAmount),
        other_note: isDriver ? undefined : (f.otherNote.trim() || undefined),
        stopovers: stopoversPayload,
      };
      const res = tripId
        ? await updateTruckTripAction({ ...payload, trip_id: tripId })
        : await createTruckTripAction(payload);
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      toast.success(tripId ? t('updatedToast') : t('createdToast'));
      router.push(
        isDriver ? '/today' : (tripId ? `/truck/trips/${tripId}` : '/truck/trips'),
      );
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Trip info */}
      <Card variant="elevated">
        <CardHeader>
          <CardHeaderText>
            <CardTitle>{t('sectionTrip')}</CardTitle>
          </CardHeaderText>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t('date')} required>
            <Input type="date" value={f.scheduledAt} onChange={set('scheduledAt')} />
          </Field>
          <Field label={t('vehicle')} required>
            <Select value={f.vehicleId} onValueChange={(v) => setF((s) => ({ ...s, vehicleId: v }))}>
              <SelectTrigger>
                <SelectValue placeholder={t('selectVehicle')} />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {!isDriver && (
            <Field label={t('driver')} required>
              <Select value={f.driverId} onValueChange={(v) => setF((s) => ({ ...s, driverId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectDriver')} />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label={t('customer')}>
            <Input value={f.customer} onChange={set('customer')} />
          </Field>
          <Field label={t('bol')}>
            <Input value={f.bol} onChange={set('bol')} />
          </Field>
          <Field label={t('cdf')}>
            <Input value={f.cdf} onChange={set('cdf')} />
          </Field>
        </CardContent>
      </Card>

      {/* Route stops */}
      <Card variant="elevated">
        <CardHeader>
          <CardHeaderText>
            <CardTitle>{t('sectionRoute')}</CardTitle>
          </CardHeaderText>
        </CardHeader>
        <CardContent>
          <StopBuilder stops={stops} onChange={setStops} showKm={false} />
        </CardContent>
      </Card>

      {/* Cost / completion */}
      <Card variant="elevated">
        <CardContent className="space-y-4">
          {!isDriver && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-text">
                  {markCompleted ? t('modeCompleted') : t('modeAssign')}
                </div>
                <div className="text-xs text-text-muted">
                  {markCompleted ? t('modeCompletedHint') : t('modeAssignHint')}
                </div>
              </div>
              <Switch checked={markCompleted} onCheckedChange={setMarkCompleted} />
            </div>
          )}

          {(!isDriver && markCompleted) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t('startOdo')}>
                <Input type="number" value={f.startOdo} onChange={set('startOdo')} />
              </Field>
              <Field label={t('endOdo')}>
                <Input type="number" value={f.endOdo} onChange={set('endOdo')} />
              </Field>
              <Field label={t('fuelLiters')}>
                <Input type="number" step="0.01" value={f.fuelLiters} onChange={set('fuelLiters')} />
              </Field>
              <Field label={t('fuelPrice')}>
                <Input type="number" value={f.fuelPrice} onChange={set('fuelPrice')} />
              </Field>
              <Field label={t('toll')}>
                <Input type="number" value={f.toll} onChange={set('toll')} />
              </Field>
              <Field label={t('revenue')}>
                <Input type="number" value={f.revenue} onChange={set('revenue')} />
              </Field>
              <Field label={t('otherAmount')}>
                <Input type="number" value={f.otherAmount} onChange={set('otherAmount')} />
              </Field>
              <Field label={t('otherNote')}>
                <Input value={f.otherNote} onChange={set('otherNote')} />
              </Field>
            </div>
          ) : (!isDriver && !markCompleted) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t('fuelPrice')}>
                <Input type="number" value={f.fuelPrice} onChange={set('fuelPrice')} />
              </Field>
              <Field label={t('revenue')}>
                <Input type="number" value={f.revenue} onChange={set('revenue')} />
              </Field>
            </div>
          ) : (
            /* Driver mode: operational costs only — no revenue */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t('fuelLiters')}>
                <Input type="number" step="0.01" value={f.fuelLiters} onChange={set('fuelLiters')} />
              </Field>
              <Field label={t('fuelPrice')}>
                <Input type="number" value={f.fuelPrice} onChange={set('fuelPrice')} />
              </Field>
              <Field label={t('toll')}>
                <Input type="number" value={f.toll} onChange={set('toll')} />
              </Field>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live profit preview — manager mark-completed mode only */}
      {!isDriver && markCompleted && (
        <div className="rounded-md border border-border bg-surface-2 p-4 grid grid-cols-3 gap-3 text-center">
          <Metric label={t('previewFuelCost')} value={vnd(preview.fuelCost)} />
          <Metric label={t('previewTotalCost')} value={vnd(preview.totalCost)} />
          <Metric
            label={t('previewProfit')}
            value={vnd(preview.profit)}
            tone={preview.profit >= 0 ? 'success' : 'danger'}
          />
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={() => router.push(isDriver ? '/today' : '/truck/trips')}
          disabled={pending}
          className="w-full sm:w-auto"
        >
          {t('cancel')}
        </Button>
        <Button
          type="submit"
          variant="accent"
          size="lg"
          disabled={pending || !dirty}
          className="w-full sm:w-auto"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t('save')}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label>
        {label} {required && <span className="text-danger">*</span>}
      </Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'danger' }) {
  return (
    <div>
      <div className="text-xs text-text-faint">{label}</div>
      <div
        className={
          'mt-0.5 text-sm font-bold tabular ' +
          (tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-text')
        }
      >
        {value}
      </div>
    </div>
  );
}
