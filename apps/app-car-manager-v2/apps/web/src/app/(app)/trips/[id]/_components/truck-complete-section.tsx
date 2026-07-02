'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button, Card, Input, Label, toast } from '@car-v2/ui';
import {
  driverCompleteTruckTripAction,
  completeTruckTripAction,
} from '@/server/actions/trips/truck-trip.actions';
import { formatActionError } from '@/lib/format-action-error';

const numF = (s: string) => (s.trim() === '' ? undefined : Number(s));
const numI = (s: string) => (s.trim() === '' ? undefined : Math.trunc(Number(s)));

interface ExtraRow {
  name: string;
  amount: string;
}

/**
 * Truck trip completion (P-E). Opened from the trip detail (not Home, per the
 * driver prototype). Captures the 7 metrics + a structured "other costs" list
 * ({name, amount} with +). Uses the driver-self action when mode='driver',
 * else the staff action.
 */
export function TruckCompleteSection({ tripId, mode }: { tripId: string; mode: 'driver' | 'staff' }) {
  const t = useTranslations('screens.truckComplete');
  const tErr = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState({ startTime: '', endTime: '', endOdo: '', fuelLiters: '', toll: '' });
  const [extras, setExtras] = useState<ExtraRow[]>([]);

  const set =
    (k: keyof typeof f) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setF((s) => ({ ...s, [k]: e.target.value }));

  const addExtra = () => setExtras((x) => [...x, { name: '', amount: '' }]);
  const setExtra = (i: number, k: keyof ExtraRow, v: string) =>
    setExtras((x) => x.map((row, j) => (j === i ? { ...row, [k]: v } : row)));
  const removeExtra = (i: number) => setExtras((x) => x.filter((_, j) => j !== i));

  const submit = () => {
    startTransition(async () => {
      const payload = {
        trip_id: tripId,
        start_time: f.startTime || undefined,
        end_time: f.endTime || undefined,
        end_odometer: numI(f.endOdo),
        fuel_liters: numF(f.fuelLiters),
        toll_fee: numF(f.toll),
        extra_costs: extras
          .filter((e) => e.name.trim() !== '' && e.amount.trim() !== '')
          .map((e) => ({ name: e.name.trim(), amount: Number(e.amount) })),
      };
      const res =
        mode === 'driver'
          ? await driverCompleteTruckTripAction(payload)
          : await completeTruckTripAction(payload);
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      toast.success(t('completedToast'));
      router.refresh();
    });
  };

  if (!open) {
    return (
      <Button variant="accent" size="lg" className="w-full" onClick={() => setOpen(true)}>
        <Check className="h-4 w-4" />
        {t('completeCta')}
      </Button>
    );
  }

  return (
    <Card variant="elevated" className="p-4 space-y-4">
      <div className="text-sm font-semibold text-text">{t('title')}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={t('startTime')}>
          <Input type="datetime-local" value={f.startTime} onChange={set('startTime')} />
        </Field>
        <Field label={t('endTime')}>
          <Input type="datetime-local" value={f.endTime} onChange={set('endTime')} />
        </Field>
        <Field label={t('endOdo')}>
          <Input type="number" value={f.endOdo} onChange={set('endOdo')} />
        </Field>
        <Field label={t('fuelLiters')}>
          <Input type="number" step="0.01" value={f.fuelLiters} onChange={set('fuelLiters')} />
        </Field>
        <Field label={t('toll')}>
          <Input type="number" value={f.toll} onChange={set('toll')} />
        </Field>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>{t('extraSection')}</Label>
        </div>
        <div className="space-y-2">
          {extras.map((row, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder={t('extraName')}
                value={row.name}
                onChange={(e) => setExtra(i, 'name', e.target.value)}
                className="flex-1"
              />
              <Input
                type="number"
                placeholder={t('extraAmount')}
                value={row.amount}
                onChange={(e) => setExtra(i, 'amount', e.target.value)}
                className="w-32"
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => removeExtra(i)} aria-label={t('extraRemove')}>
                <Trash2 className="h-4 w-4 text-text-faint" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={addExtra} iconLeft={<Plus className="h-3.5 w-3.5" />}>
            {t('extraAdd')}
          </Button>
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-2 border-t border-border">
        <Button type="button" variant="ghost" size="lg" onClick={() => setOpen(false)} disabled={pending}>
          {t('cancel')}
        </Button>
        <Button type="button" variant="accent" size="lg" onClick={submit} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {t('confirm')}
        </Button>
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
