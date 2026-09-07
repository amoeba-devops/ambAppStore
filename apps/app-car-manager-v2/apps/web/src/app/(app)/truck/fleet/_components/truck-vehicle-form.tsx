'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Info, Loader2, Save, Trash2 } from 'lucide-react';
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
import { TRUCK_REGIONS } from '@car-v2/shared/zod';
import { formatActionError } from '@/lib/format-action-error';
import { formatDayKey } from '@/lib/format-day';

const FUELS = ['DIESEL', 'PETROL', 'HYBRID', 'EV'] as const;
const NO_REGION = '__none__';
const NO_DRIVER = '__none__';
/* The only statuses a user may set on a truck (REQ-20260907 BR-3). MAINTENANCE
 * is derived from the Maintenance menu and never offered here. Kept local —
 * this is a client component, so it must not import the server-side core. */
const STORED_STATUSES = ['AVAILABLE', 'RETIRED'] as const;

const EMPTY = {
  status: 'AVAILABLE' as (typeof STORED_STATUSES)[number],
  plate: '',
  code: '',
  model: '',
  make: '',
  year: '',
  tonnage: '',
  fuelType: 'DIESEL',
  region: '',
  defaultDriverId: '',
  depreciation: '',
  odometer: '',
  oilIntervalKm: '8000',
  lastOilChangeKm: '',
  homeBase: '',
  notes: '',
};

export function TruckVehicleForm({
  vehicleId,
  initial,
  drivers = [],
  regionOptions = TRUCK_REGIONS,
  maintenanceUntil = null,
}: {
  /** When set, the form edits this vehicle (calls updateVehicleAction). */
  vehicleId?: string;
  initial?: Partial<typeof EMPTY>;
  /** 'YYYY-MM-DD' end of the maintenance window covering today, when the truck
   * is currently under maintenance (derived status, REQ-20260907 BR-7). */
  maintenanceUntil?: string | null;
  /** Truck drivers for the "Tài xế mặc định" select. A `stale` entry is the
   * vehicle's saved default driver who no longer has active TRUCK access —
   * shown disabled instead of leaving the Select blank. */
  drivers?: { id: string; name: string; stale?: boolean }[];
  /** Regions the editor may assign (region ACL, REQ-20260813). */
  regionOptions?: readonly string[];
} = {}) {
  const t = useTranslations('screens.truckFleet.form');
  const tFuel = useTranslations('vehicles.fuel');
  const tRegion = useTranslations('region');
  const tStatus = useTranslations('screens.truckFleet.status');
  const tErr = useTranslations();
  const locale = useLocale();
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
        code: f.code.trim() || undefined,
        model: f.model.trim(),
        make: f.make.trim() || undefined,
        year: f.year ? Number(f.year) : undefined,
        fuel_type: f.fuelType as (typeof FUELS)[number],
        vehicle_type: 'TRUCK' as const,
        tonnage: f.tonnage ? Number(f.tonnage) : undefined,
        region: (f.region || undefined) as (typeof TRUCK_REGIONS)[number] | undefined,
        default_driver_id: f.defaultDriverId || undefined,
        depreciation: f.depreciation ? Number(f.depreciation) : undefined,
        odometer_km: f.odometer ? Number(f.odometer) : undefined,
        oil_interval_km: f.oilIntervalKm ? Number(f.oilIntervalKm) : undefined,
        last_oil_change_km: f.lastOilChangeKm ? Number(f.lastOilChangeKm) : undefined,
        home_base: f.homeBase.trim() || undefined,
        notes: f.notes.trim() || undefined,
        /* Status is edit-only: create has no field and the create schema has
         * no `status`; a new truck starts AVAILABLE. */
        ...(vehicleId ? { status: f.status } : {}),
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
            <Field label={t('code')}>
              <Input value={f.code} onChange={set('code')} placeholder="160-99362141" />
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
            <Field label={t('region')}>
              <Select
                value={f.region || NO_REGION}
                onValueChange={(v) => setF((s) => ({ ...s, region: v === NO_REGION ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_REGION}>{t('regionNone')}</SelectItem>
                  {regionOptions.map((r) => (
                    <SelectItem key={r} value={r}>
                      {tRegion(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {vehicleId && (
              <Field label={t('status')}>
                <Select
                  value={f.status}
                  onValueChange={(v) => setF((s) => ({ ...s, status: v as (typeof STORED_STATUSES)[number] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STORED_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {tStatus(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1.5 text-xs text-text-muted leading-relaxed">{t('statusHint')}</p>
              </Field>
            )}
            <Field label={t('defaultDriver')}>
              <Select
                value={f.defaultDriverId || NO_DRIVER}
                onValueChange={(v) => setF((s) => ({ ...s, defaultDriverId: v === NO_DRIVER ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DRIVER}>{t('driverNone')}</SelectItem>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id} disabled={d.stale}>
                      {d.stale ? `${d.name} ${t('driverStaleSuffix')}` : d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('depreciation')}>
              <Input type="number" value={f.depreciation} onChange={set('depreciation')} placeholder="1000000" />
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

          {/* Derived "Bảo trì" (REQ-20260907): the select above keeps the stored
           * value; this note tells the editor why the list shows Maintenance. */}
          {vehicleId && maintenanceUntil && (
            <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2.5 text-xs text-text leading-relaxed">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <span>
                {t('statusMaintenanceNote', { date: fmtDay(maintenanceUntil, locale) })}{' '}
                <Link href={`/truck/maintenance?vehicle=${vehicleId}`} className="font-semibold text-accent hover:underline">
                  {t('statusMaintenanceLink')}
                </Link>
              </span>
            </div>
          )}

          <Field label={t('notes')}>
            <Input value={f.notes} onChange={set('notes')} placeholder={t('notesPlaceholder')} />
          </Field>

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

/** 'YYYY-MM-DD' (UTC day) → the workspace's dd/mm/yyyy, in the viewer's locale. */
function fmtDay(iso: string, locale: string): string {
  const loc = locale === 'vi' ? 'vi-VN' : locale === 'ko' ? 'ko-KR' : 'en-US';
  return formatDayKey(iso, loc);
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
