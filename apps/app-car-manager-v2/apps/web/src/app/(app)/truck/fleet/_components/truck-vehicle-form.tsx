'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, Save, Trash2 } from 'lucide-react';
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
  toast,
} from '@car-v2/ui';
import {
  createVehicleAction,
  updateVehicleAction,
  deleteVehicleAction,
} from '@/server/actions/vehicles/vehicle.actions';
import { formatActionError } from '@/lib/format-action-error';

const FUELS = ['DIESEL', 'PETROL', 'HYBRID', 'EV'] as const;

const EMPTY = {
  plate: '',
  model: '',
  make: '',
  year: '',
  tonnage: '',
  fuelQuota: '',
  fuelType: 'DIESEL',
  odometer: '',
  oilIntervalKm: '8000',
  lastOilChangeKm: '',
  homeBase: '',
  notes: '',
};

export function TruckVehicleForm({
  vehicleId,
  initial,
}: {
  /** When set, the form edits this vehicle (calls updateVehicleAction). */
  vehicleId?: string;
  initial?: Partial<typeof EMPTY>;
} = {}) {
  const t = useTranslations('screens.truckFleet.form');
  const tFuel = useTranslations('vehicles.fuel');
  const tErr = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState({ ...EMPTY, ...initial });

  const set =
    (k: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setF((s) => ({ ...s, [k]: e.target.value }));

  const dirty = f.plate.trim() !== '' && f.model.trim() !== '';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    startTransition(async () => {
      const payload = {
        plate_number: f.plate.trim(),
        model: f.model.trim(),
        make: f.make.trim() || undefined,
        year: f.year ? Number(f.year) : undefined,
        fuel_type: f.fuelType as (typeof FUELS)[number],
        vehicle_type: 'TRUCK' as const,
        tonnage: f.tonnage ? Number(f.tonnage) : undefined,
        fuel_quota: f.fuelQuota ? Number(f.fuelQuota) : undefined,
        odometer_km: f.odometer ? Number(f.odometer) : undefined,
        oil_interval_km: f.oilIntervalKm ? Number(f.oilIntervalKm) : undefined,
        last_oil_change_km: f.lastOilChangeKm ? Number(f.lastOilChangeKm) : undefined,
        home_base: f.homeBase.trim() || undefined,
        notes: f.notes.trim() || undefined,
      };
      const res = vehicleId
        ? await updateVehicleAction(vehicleId, payload)
        : await createVehicleAction(payload);
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      toast.success(t(vehicleId ? 'updatedToast' : 'createdToast', { plate: f.plate.trim() }));
      router.push('/truck/fleet');
      router.refresh();
    });
  };

  const del = () => {
    if (!vehicleId || !confirm(t('deleteConfirm'))) return;
    startTransition(async () => {
      const res = await deleteVehicleAction(vehicleId);
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      toast.success(t('deletedToast'));
      router.push('/truck/fleet');
      router.refresh();
    });
  };

  return (
    <Card variant="elevated">
      <CardHeader>
        <CardHeaderText>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeaderText>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t('plate')} required>
              <Input value={f.plate} onChange={set('plate')} placeholder="50E-32407" />
            </Field>
            <Field label={t('model')} required>
              <Input value={f.model} onChange={set('model')} placeholder="Dongfeng 4.5T" />
            </Field>
            <Field label={t('make')}>
              <Input value={f.make} onChange={set('make')} />
            </Field>
            <Field label={t('year')}>
              <Input type="number" value={f.year} onChange={set('year')} placeholder="2022" />
            </Field>
            <Field label={t('tonnage')}>
              <Input type="number" step="0.1" value={f.tonnage} onChange={set('tonnage')} placeholder="4.5" />
            </Field>
            <Field label={t('fuelQuota')}>
              <Input type="number" step="0.1" value={f.fuelQuota} onChange={set('fuelQuota')} placeholder="6.5" />
            </Field>
            <Field label={t('fuelType')}>
              <Select value={f.fuelType} onValueChange={(v) => setF((s) => ({ ...s, fuelType: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FUELS.map((fuel) => (
                    <SelectItem key={fuel} value={fuel}>
                      {tFuel(fuel)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('odometer')}>
              <Input type="number" value={f.odometer} onChange={set('odometer')} placeholder="45000" />
            </Field>
            <Field label={t('oilIntervalKm')}>
              <Input type="number" value={f.oilIntervalKm} onChange={set('oilIntervalKm')} placeholder="8000" />
            </Field>
            <Field label={t('lastOilChangeKm')}>
              <Input type="number" value={f.lastOilChangeKm} onChange={set('lastOilChangeKm')} placeholder="135000" />
            </Field>
            <Field label={t('homeBase')}>
              <Input value={f.homeBase} onChange={set('homeBase')} />
            </Field>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t border-border">
            {vehicleId && (
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={del}
                disabled={pending}
                className="w-full sm:w-auto sm:mr-auto text-danger hover:text-danger hover:bg-danger-soft"
                iconLeft={<Trash2 className="h-4 w-4" />}
              >
                {t('delete')}
              </Button>
            )}
            <Button type="button" variant="ghost" size="lg" onClick={() => router.push('/truck/fleet')} disabled={pending} className="w-full sm:w-auto">
              {t('cancel')}
            </Button>
            <Button type="submit" variant="accent" size="lg" disabled={pending || !dirty} className="w-full sm:w-auto">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
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
