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
import { createTruckTripAction, updateTruckTripAction } from '@/server/actions/trips/truck-trip.actions';
import { formatActionError } from '@/lib/format-action-error';

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
  /** true = log a finished trip; false = assign to driver to complete later. */
  markCompleted: boolean;
}>;

const todayIso = () => new Date().toISOString().slice(0, 10);

const EMPTY = {
  scheduledAt: todayIso(),
  vehicleId: '',
  driverId: '',
  customer: '',
  pickup: '',
  dropoff: '',
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

export function TruckTripForm({
  vehicles,
  drivers,
  tripId,
  initial,
}: {
  vehicles: OptionItem[];
  drivers: OptionItem[];
  /** When set, the form edits this trip (calls updateTruckTripAction). */
  tripId?: string;
  initial?: TruckTripFormInitial;
}) {
  const t = useTranslations('screens.truckTrips.form');
  const tErr = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState({ ...EMPTY, ...initial });
  /* true = log a finished trip (default); false = create assigned + let the
   * driver complete it later (status stays CONFIRMED → driver's "to complete"). */
  const [markCompleted, setMarkCompleted] = useState(initial?.markCompleted ?? true);

  const set =
    (k: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setF((s) => ({ ...s, [k]: e.target.value }));

  /* Live profit preview — mirrors core computeTruckCost. */
  const preview = useMemo(() => {
    const fuelCost = Math.round((numF(f.fuelLiters) ?? 0) * (numF(f.fuelPrice) ?? 0));
    const toll = Math.round(numF(f.toll) ?? 0);
    const other = Math.round(numF(f.otherAmount) ?? 0);
    const revenue = Math.round(numF(f.revenue) ?? 0);
    const totalCost = fuelCost + toll + other;
    return { fuelCost, totalCost, profit: revenue - totalCost };
  }, [f.fuelLiters, f.fuelPrice, f.toll, f.otherAmount, f.revenue]);

  const dirty =
    f.vehicleId !== '' && f.driverId !== '' && f.pickup.trim() !== '' && f.dropoff.trim() !== '';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    startTransition(async () => {
      const payload = {
        scheduled_at: f.scheduledAt,
        vehicle_id: f.vehicleId || undefined,
        driver_id: f.driverId || undefined,
        customer: f.customer.trim() || undefined,
        pickup_address: f.pickup.trim(),
        dropoff_address: f.dropoff.trim(),
        bol: f.bol.trim() || undefined,
        cdf: f.cdf.trim() || undefined,
        revenue: numF(f.revenue),
        fuel_price: numF(f.fuelPrice),
        mark_completed: markCompleted,
        start_odometer: numI(f.startOdo),
        end_odometer: numI(f.endOdo),
        fuel_liters: numF(f.fuelLiters),
        toll_fee: numF(f.toll),
        other_amount: numF(f.otherAmount),
        other_note: f.otherNote.trim() || undefined,
      };
      const res = tripId
        ? await updateTruckTripAction({ ...payload, trip_id: tripId })
        : await createTruckTripAction(payload);
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      toast.success(tripId ? t('updatedToast') : t('createdToast'));
      router.push(tripId ? `/truck/trips/${tripId}` : '/truck/trips');
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
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
          <Field label={t('customer')}>
            <Input value={f.customer} onChange={set('customer')} />
          </Field>
          <Field label={t('pickup')} required>
            <Input value={f.pickup} onChange={set('pickup')} />
          </Field>
          <Field label={t('dropoff')} required>
            <Input value={f.dropoff} onChange={set('dropoff')} />
          </Field>
          <Field label={t('bol')}>
            <Input value={f.bol} onChange={set('bol')} />
          </Field>
          <Field label={t('cdf')}>
            <Input value={f.cdf} onChange={set('cdf')} />
          </Field>
        </CardContent>
      </Card>

      <Card variant="elevated">
        <CardContent className="space-y-4">
          {/* Mode: log a finished trip vs assign to a driver to complete later. */}
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

          {markCompleted ? (
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
          ) : (
            /* Assign mode — manager sets economics; driver fills the rest. */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t('fuelPrice')}>
                <Input type="number" value={f.fuelPrice} onChange={set('fuelPrice')} />
              </Field>
              <Field label={t('revenue')}>
                <Input type="number" value={f.revenue} onChange={set('revenue')} />
              </Field>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live profit preview — only meaningful when logging a finished trip. */}
      {markCompleted && (
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
        <Button type="button" variant="ghost" size="lg" onClick={() => router.push('/truck/trips')} disabled={pending} className="w-full sm:w-auto">
          {t('cancel')}
        </Button>
        <Button type="submit" variant="accent" size="lg" disabled={pending || !dirty} className="w-full sm:w-auto">
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
