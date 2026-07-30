'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ClipboardList, FileText, Loader2, Plus, Route, Save, Trash2, Truck, User, Wallet } from 'lucide-react';
import {
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsList,
  TabsTrigger,
  toast,
} from '@car-v2/ui';
import type { LocalRole } from '@car-v2/shared/auth';
import { createTruckTripAction, updateTruckTripAction } from '@/server/actions/trips/truck-trip.actions';
import { formatActionError } from '@/lib/format-action-error';
import { FormField } from '@/components/forms/form-section';
import { MoneyInput } from '@/components/inputs/money-input';
import { CostReceiptInput, type ExistingCostAttachment } from '@/components/truck/cost-receipt-input';
import { fuelToastDescription } from '@/components/truck/fuel-toast';
import { uploadTruckCostFile } from '@/lib/truck-cost-upload';
import { StopBuilder, makeDefaultStops, type StopField } from './stop-builder';
import type { CarStopType, CarTripStopover } from '@car-v2/db/schema';

type CostKind = 'FUEL' | 'TOLL' | 'EXTRA';
/** Per-bucket receipt state: already-saved attachments + newly picked files. */
interface ReceiptBucket {
  existing: ExistingCostAttachment[];
  files: File[];
}
export interface InitialCostAttachment extends ExistingCostAttachment {
  costKind: CostKind;
}

export interface OptionItem {
  id: string;
  label: string;
  /** Vehicle's assigned default driver (cvh_default_driver_id) — drives auto-fill on vehicle select. */
  defaultDriverId?: string;
  /** Vehicle fuel rate (REQ-20260724) — định mức L/100km + giá đ/L. Drives the
   * read-only fuel preview: fuel = km × (quota/100) × price. */
  fuelQuota?: number | null;
  fuelPrice?: number | null;
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
  fuelLiters: string;
  toll: string;
  extraCosts: { name: string; amount: number }[];
  costAttachments: InitialCostAttachment[];
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
  fuelLiters: '',
  toll: '',
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
  const tFuel = useTranslations('screens.truckFinance');
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

  /* Extra incidental costs — free-text name + amount rows. */
  const [extras, setExtras] = useState<ExtraRow[]>(
    () => initial?.extraCosts?.map((e) => ({ name: e.name, amount: String(e.amount) })) ?? [],
  );
  const addExtra = () => setExtras((x) => [...x, { name: '', amount: '' }]);
  const setExtra = (i: number, k: keyof ExtraRow, v: string) =>
    setExtras((x) => x.map((row, j) => (j === i ? { ...row, [k]: v } : row)));
  const removeExtra = (i: number) => setExtras((x) => x.filter((_, j) => j !== i));

  /* Cost receipt attachments (REQ-20260709) — one bucket per cost kind, each
   * holding already-saved attachments (edit) + newly picked files. */
  const [receipts, setReceipts] = useState<Record<CostKind, ReceiptBucket>>(() => {
    const init: Record<CostKind, ReceiptBucket> = {
      FUEL: { existing: [], files: [] },
      TOLL: { existing: [], files: [] },
      EXTRA: { existing: [], files: [] },
    };
    for (const a of initial?.costAttachments ?? []) {
      init[a.costKind].existing.push({ id: a.id, s3Key: a.s3Key, mime: a.mime, sizeBytes: a.sizeBytes, signedUrl: a.signedUrl });
    }
    return init;
  });
  const setBucketExisting = (k: CostKind, next: ExistingCostAttachment[]) =>
    setReceipts((r) => ({ ...r, [k]: { ...r[k], existing: next } }));
  const setBucketFiles = (k: CostKind, next: File[]) =>
    setReceipts((r) => ({ ...r, [k]: { ...r[k], files: next } }));

  /* Build the full desired attachment set: kept existing keys + freshly
   * uploaded files (uploaded here, on submit). Throws if any S3 PUT fails. */
  const buildCostAttachments = async (): Promise<
    { cost_kind: CostKind; s3_key: string; mime: string; size_bytes: number }[]
  > => {
    const out: { cost_kind: CostKind; s3_key: string; mime: string; size_bytes: number }[] = [];
    for (const k of ['FUEL', 'TOLL', 'EXTRA'] as const) {
      for (const e of receipts[k].existing) {
        out.push({ cost_kind: k, s3_key: e.s3Key, mime: e.mime, size_bytes: e.sizeBytes });
      }
      for (const f of receipts[k].files) {
        const up = await uploadTruckCostFile(f);
        out.push({ cost_kind: k, ...up });
      }
    }
    return out;
  };

  /* Optional fields stay collapsed by default to keep the form light — they
   * auto-expand on edit when the trip already carries that data. */
  const [showDocs, setShowDocs] = useState(
    () => !!(initial?.customer || initial?.bol || initial?.cdf),
  );

  const set =
    (k: keyof typeof EMPTY_FIELDS) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setF((s) => ({ ...s, [k]: e.target.value }));

  /* Setter for MoneyInput (receives the raw digit string, not an event). */
  const setNum = (k: keyof typeof EMPTY_FIELDS) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  /* Selected vehicle's fuel rate → the DEFAULT per-trip fuel (REQ-20260724):
   * fuel = km × (định mức/100) × giá của xe. Litres/đơn giá are no longer
   * entered per trip; they're derived from the vehicle here. */
  const selectedVehicle = vehicles.find((v) => v.id === f.vehicleId);
  const vehicleQuota = selectedVehicle?.fuelQuota ?? null;
  const vehiclePrice = selectedVehicle?.fuelPrice ?? null;
  const hasVehicleRate = (vehicleQuota ?? 0) > 0 && (vehiclePrice ?? 0) > 0;

  /* Live profit preview. Fuel = km × vehicle rate (the actual cost model);
   * 0 when the vehicle has no rate set (surfaced as a hint in the summary). */
  const preview = useMemo(() => {
    const kmNums = stops.map((s) => (s.km.trim() ? Number(s.km) : null));
    const first = kmNums.find((v) => v != null);
    const last = [...kmNums].reverse().find((v) => v != null);
    const km = first != null && last != null && last > first ? last - first : 0;
    const fuelCost =
      km > 0 && (vehicleQuota ?? 0) > 0 && (vehiclePrice ?? 0) > 0
        ? Math.round(km * ((vehicleQuota as number) / 100) * (vehiclePrice as number))
        : 0;
    const toll = Math.round(numF(f.toll) ?? 0);
    const extraTotal = extras.reduce((s, e) => s + Math.round(numF(e.amount) ?? 0), 0);
    const revenue = Math.round(numF(f.revenue) ?? 0);
    const totalCost = fuelCost + toll + extraTotal;
    return { fuelCost, totalCost, revenue, profit: revenue - totalCost };
  }, [stops, vehicleQuota, vehiclePrice, f.toll, f.revenue, extras]);

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

  /* Derived summary data. */
  const vehicleLabel = selectedVehicle?.label ?? null;
  const driverLabel = drivers.find((d) => d.id === f.driverId)?.label ?? null;
  const selectedVehicleDefaultDriverId = selectedVehicle?.defaultDriverId;
  const isDriverAutoFilled = !!selectedVehicleDefaultDriverId && selectedVehicleDefaultDriverId === f.driverId;
  const kmNums = stops.map((s) => (s.km.trim() ? Number(s.km) : null));
  const firstKm = kmNums.find((v) => v != null);
  const lastKm = [...kmNums].reverse().find((v) => v != null);
  const totalKm = firstKm != null && lastKm != null && lastKm > firstKm ? lastKm - firstKm : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty) {
      const missing: string[] = [];
      if (f.vehicleId === '') missing.push(t('vehicle'));
      if (!isDriver && f.driverId === '') missing.push(t('driver'));
      if (pickupAddress === '') missing.push(t('pickup'));
      if (dropoffAddress === '') missing.push(t('dropoff'));
      toast.error(t('validationMissing', { fields: missing.join(', ') }));
      return;
    }
    startTransition(async () => {
      const stopoversPayload = stops
        .filter((s) => s.address.trim() !== '' || s.type === 'PICKUP' || s.type === 'DELIVERY')
        .map((s) => ({
          type: s.type,
          address: s.address.trim(),
          km: s.km ? Number(s.km) : undefined,
        }));

      /* Upload any newly picked receipts to S3 first. On failure, abort before
       * touching the trip so we don't half-save. */
      let cost_attachments: { cost_kind: CostKind; s3_key: string; mime: string; size_bytes: number }[];
      try {
        cost_attachments = await buildCostAttachments();
      } catch {
        toast.error(t('receiptUploadFailed'));
        return;
      }

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
        start_odometer: numI(stops.find((s) => s.type === 'ORIGIN')?.km ?? ''),
        end_odometer: numI(stops.slice().reverse().find((s) => s.type === 'RETURN')?.km ?? stops[stops.length - 1]?.km ?? ''),
        fuel_liters: numF(f.fuelLiters),
        toll_fee: numF(f.toll),
        extra_costs: extras
          .filter((e) => e.name.trim() !== '' && e.amount.trim() !== '')
          .map((e) => ({ name: e.name.trim(), amount: Number(e.amount) })),
        cost_attachments,
        stopovers: stopoversPayload,
      };
      const res = tripId
        ? await updateTruckTripAction({ ...payload, trip_id: tripId })
        : await createTruckTripAction(payload);
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      /* Tell the user how the per-trip fuel was treated on save (REQ-20260724):
       * averaged (invoices) / vehicle rate (km × định mức × giá xe) / unset
       * (xe chưa đặt định mức → 0). Server returns null for a non-completed
       * trip → no fuel note. */
      toast.success(tripId ? t('updatedToast') : t('createdToast'), {
        description: fuelToastDescription(res.data.fuelMode, tFuel),
      });
      router.push(
        isDriver ? '/today' : (tripId ? `/truck/trips/${tripId}` : '/truck/trips'),
      );
      router.refresh();
    });
  };

  /* Receipt attachments block (REQ-20260709) — three buckets (fuel / toll /
   * extra), shown wherever those costs are entered (driver + manager-log). */
  const receiptsBlock = (
    <div className="mt-4 pt-4 border-t border-border space-y-3">
      <div className="text-xs font-medium text-text-muted uppercase tracking-wide">{t('receiptsSection')}</div>
      {(['FUEL', 'TOLL', 'EXTRA'] as const).map((k) => (
        <div key={k} className="space-y-1.5">
          <div className="text-xs text-text-muted">{t(RECEIPT_LABEL[k])}</div>
          <CostReceiptInput
            existing={receipts[k].existing}
            onExistingChange={(next) => setBucketExisting(k, next)}
            files={receipts[k].files}
            onFilesChange={(next) => setBucketFiles(k, next)}
            disabled={pending}
          />
        </div>
      ))}
    </div>
  );

  /* Fuel is derived from the vehicle's rate (REQ-20260724) — no per-trip litres/
   * price input. Read-only info: computed preview, or a prompt to set the rate. */
  const fuelInfo = (
    <div className="rounded-md border border-border bg-surface-2/40 px-3 py-2.5 text-sm space-y-0.5 sm:col-span-2">
      {!f.vehicleId ? (
        <p className="text-text-faint">{t('fuelSelectVehicleFirst')}</p>
      ) : hasVehicleRate ? (
        <>
          {/* Per-trip arithmetic first (km is what the user is editing), with the
            * vehicle rate spelled out underneath. The sentence explaining the
            * formula was dropped (QA 2026-07-29) — the two lines below already
            * show it as arithmetic. */}
          <p className="text-text">
            {(totalKm ?? 0).toLocaleString('vi-VN')} km ×{' '}
            {vnd(Math.round(((vehicleQuota as number) / 100) * (vehiclePrice as number)))}/km ={' '}
            <span className="font-semibold">{vnd(preview.fuelCost)}</span>
          </p>
          <p className="text-xs text-text-faint">
            {vehicleQuota} L/100km × {vnd(vehiclePrice as number)}/L
          </p>
        </>
      ) : (
        <p className="text-warning">{t('fuelRateNotSet')}</p>
      )}
    </div>
  );

  return (
    <form
      onSubmit={submit}
      noValidate
      className="space-y-4 lg:space-y-6 lg:[&_input]:h-11 lg:[&_input]:text-[15px] lg:[&_label]:text-[13px]"
    >
      {/* Record-type segmented control — manager only, drives the whole form. */}
      {!isDriver && (
        <div className="rounded-lg border border-border bg-surface p-4 lg:p-5">
          <Tabs value={markCompleted ? 'log' : 'assign'} onValueChange={(v) => setMarkCompleted(v === 'log')}>
            <TabsList className="w-full max-w-md">
              <TabsTrigger value="assign" className="flex-1 h-11 md:h-7">{t('modeAssignShort')}</TabsTrigger>
              <TabsTrigger value="log" className="flex-1 h-11 md:h-7">{t('modeCompletedShort')}</TabsTrigger>
            </TabsList>
          </Tabs>
          <p className="mt-2 text-xs text-text-muted">
            {markCompleted ? t('modeCompletedHint') : t('modeAssignHint')}
          </p>
        </div>
      )}

      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-10 xl:items-start">
        {/* ── LEFT: form fields ── */}
        <div className="min-w-0 space-y-4 lg:space-y-6 mb-5 xl:mb-0">
          {/* Trip info */}
          <SectionCard icon={<ClipboardList className="h-4 w-4" />} title={t('sectionTrip')}>
            <div className={GRID}>
              <FormField label={t('date')} required inline>
                <Input type="date" value={f.scheduledAt} onChange={set('scheduledAt')} />
              </FormField>
              <FormField label={t('vehicle')} required inline>
                <Select
                  value={f.vehicleId}
                  onValueChange={(v) => {
                    const defaultDriverId = vehicles.find((o) => o.id === v)?.defaultDriverId;
                    const canAutoFill = !isDriver && !!defaultDriverId && drivers.some((d) => d.id === defaultDriverId);
                    setF((s) => ({ ...s, vehicleId: v, driverId: canAutoFill ? defaultDriverId : s.driverId }));
                  }}
                >
                  <SelectTrigger className="w-full lg:h-11 lg:text-[15px]">
                    <SelectValue placeholder={t('selectVehicle')} />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              {!isDriver && (
                <FormField
                  label={t('driver')}
                  required
                  inline
                  className="sm:col-span-2"
                  hint={isDriverAutoFilled && driverLabel ? t('driverAutoFilled', { driver: driverLabel }) : undefined}
                >
                  <Select value={f.driverId} onValueChange={(v) => setF((s) => ({ ...s, driverId: v }))}>
                    <SelectTrigger className="w-full lg:h-11 lg:text-[15px]">
                      <SelectValue placeholder={t('selectDriver')} />
                    </SelectTrigger>
                    <SelectContent>
                      {drivers.map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              )}
            </div>
          </SectionCard>

          {/* Route — km inputs only when logging a completed trip. */}
          <SectionCard icon={<Route className="h-4 w-4" />} title={t('sectionRoute')}>
            <StopBuilder stops={stops} onChange={setStops} showKm={!isDriver && markCompleted} />
          </SectionCard>

          {/* Customer & documents — optional, collapsed by default. */}
          {showDocs ? (
            <SectionCard icon={<FileText className="h-4 w-4" />} title={t('sectionDocs')}>
              <div className={GRID}>
                <FormField label={t('customer')} inline>
                  <Input value={f.customer} onChange={set('customer')} />
                </FormField>
                <FormField label={t('bol')} inline>
                  <Input value={f.bol} onChange={set('bol')} />
                </FormField>
                <FormField label={t('cdf')} inline className="sm:col-span-2">
                  <Input value={f.cdf} onChange={set('cdf')} />
                </FormField>
              </div>
            </SectionCard>
          ) : (
            <DisclosureButton label={t('addDocs')} onClick={() => setShowDocs(true)} />
          )}

          {/* Costs — three role/mode shapes. */}
          {isDriver ? (
            <SectionCard icon={<Wallet className="h-4 w-4" />} title={t('sectionCost')}>
              <div className={GRID}>
                {fuelInfo}
                <FormField label={t('toll')} inline className="sm:col-span-2">
                  <MoneyInput value={f.toll} onChange={setNum('toll')} />
                </FormField>
              </div>
              <ExtrasCostSection extras={extras} t={t} onAdd={addExtra} onChange={setExtra} onRemove={removeExtra} />
              {receiptsBlock}
            </SectionCard>
          ) : markCompleted ? (
            <SectionCard icon={<Wallet className="h-4 w-4" />} title={t('sectionCostRevenue')}>
              <div className={GRID}>
                {fuelInfo}
                <FormField label={t('toll')} inline>
                  <MoneyInput value={f.toll} onChange={setNum('toll')} />
                </FormField>
                <FormField label={t('revenue')} inline>
                  <MoneyInput value={f.revenue} onChange={setNum('revenue')} />
                </FormField>
              </div>
              <ExtrasCostSection extras={extras} t={t} onAdd={addExtra} onChange={setExtra} onRemove={removeExtra} />
              {receiptsBlock}
            </SectionCard>
          ) : (
            <SectionCard icon={<Wallet className="h-4 w-4" />} title={t('sectionPlan')} hint={t('sectionPlanHint')}>
              <div className={GRID}>
                <FormField label={t('revenue')} inline>
                  <MoneyInput value={f.revenue} onChange={setNum('revenue')} />
                </FormField>
              </div>
            </SectionCard>
          )}
        </div>

        {/* ── RIGHT: live summary (sticky 2-col on wide screens, stacks below otherwise) ── */}
        <aside className="xl:sticky xl:top-4">
          <TripSummary
            t={t}
            stops={stops}
            vehicleLabel={vehicleLabel}
            driverLabel={isDriver ? null : driverLabel}
            totalKm={totalKm}
            showProfit={!isDriver && markCompleted}
            showCostOnly={isDriver}
            revenue={preview.revenue}
            totalCost={preview.totalCost}
            profit={preview.profit}
          />
        </aside>
      </div>

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-border">
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
        <Button type="submit" variant="accent" size="lg" disabled={pending} className="w-full sm:w-auto">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t('save')}
        </Button>
      </div>
    </form>
  );
}

const GRID = 'grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3 lg:gap-y-4';

/** i18n key (under screens.truckTrips.form) for each bucket's receipt label. */
const RECEIPT_LABEL: Record<CostKind, string> = {
  FUEL: 'fuelReceipts',
  TOLL: 'tollReceipts',
  EXTRA: 'extraReceipts',
};

/** Titled white card with an accent icon — the visual unit of the form. */
function SectionCard({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 lg:p-6">
      <div className="mb-4 flex items-baseline gap-2">
        <span className="text-accent translate-y-0.5 [&_svg]:h-5 [&_svg]:w-5">{icon}</span>
        <h3 className="text-sm lg:text-base font-medium text-text">{title}</h3>
        {hint && <span className="text-xs text-text-faint">· {hint}</span>}
      </div>
      {children}
    </section>
  );
}

/** Ghost "+ add" affordance that reveals an optional field group. `bare` drops
 * the card border (used inline inside another section). */
function DisclosureButton({ label, onClick, bare }: { label: string; onClick: () => void; bare?: boolean }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={
        'h-11 md:h-9 gap-1.5 text-xs text-text-muted hover:text-text ' +
        (bare ? '' : 'w-full justify-start rounded-lg border border-dashed border-border-strong')
      }
    >
      <Plus className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}

const DOT_COLOR: Record<CarStopType, string> = {
  ORIGIN: 'bg-accent',
  PICKUP: 'bg-warning',
  DELIVERY: 'bg-success',
  WAYPOINT: 'bg-text-faint',
  RETURN: 'bg-accent',
};

/** Live trip summary — route preview, distance, and the money story. */
function TripSummary({
  t,
  stops,
  vehicleLabel,
  driverLabel,
  totalKm,
  showProfit,
  showCostOnly,
  revenue,
  totalCost,
  profit,
}: {
  t: (key: string) => string;
  stops: StopField[];
  vehicleLabel: string | null;
  driverLabel: string | null;
  totalKm: number | null;
  showProfit: boolean;
  showCostOnly: boolean;
  revenue: number;
  totalCost: number;
  profit: number;
}) {
  const filled = stops.filter((s) => s.address.trim() !== '');
  const hasChips = !!vehicleLabel || !!driverLabel;

  return (
    <div className="rounded-lg border border-border bg-surface p-4 lg:p-5 space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm lg:text-base font-medium text-text">{t('summaryTitle')}</div>
        {/* Sheet-2 T12 — figures here are a live estimate, not the final report. */}
        {(showProfit || showCostOnly) && (
          <Badge tone="neutral" size="sm">{t('provisionalTag')}</Badge>
        )}
      </div>

      {/* Route preview */}
      {filled.length > 0 ? (
        <ul className="space-y-2">
          {filled.map((s) => (
            <li key={s.id} className="flex items-center gap-2.5 text-sm">
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${DOT_COLOR[s.type]}`} />
              <span className="truncate text-text-muted">{s.address.trim()}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-faint">{t('summaryEmpty')}</p>
      )}

      {/* Vehicle / driver chips */}
      {hasChips && (
        <div className="flex flex-wrap gap-1.5">
          {vehicleLabel && <Chip icon={<Truck className="h-3 w-3" />} text={vehicleLabel} />}
          {driverLabel && <Chip icon={<User className="h-3 w-3" />} text={driverLabel} />}
        </div>
      )}

      {/* Stats */}
      {(totalKm != null || showProfit || showCostOnly) && (
        <div className="border-t border-border pt-3 space-y-2">
          {totalKm != null && (
            <StatRow label={t('stops.totalDistance')} value={`${totalKm.toLocaleString('vi-VN')} km`} />
          )}
          {showProfit && (
            <>
              <StatRow label={t('revenue')} value={vnd(revenue)} />
              <StatRow label={t('previewTotalCost')} value={vnd(totalCost)} />
              <div
                className={
                  'mt-1.5 flex items-center justify-between rounded-md px-3.5 py-3 ' +
                  (profit >= 0 ? 'bg-success-soft' : 'bg-danger-soft')
                }
              >
                <span className={'text-sm ' + (profit >= 0 ? 'text-success' : 'text-danger')}>
                  {t('previewProfit')}
                </span>
                <span className={'text-xl font-bold tabular ' + (profit >= 0 ? 'text-success' : 'text-danger')}>
                  {vnd(profit)}
                </span>
              </div>
            </>
          )}
          {showCostOnly && <StatRow label={t('previewTotalCost')} value={vnd(totalCost)} />}
        </div>
      )}
    </div>
  );
}

function Chip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 text-xs text-text-muted max-w-full">
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{text}</span>
    </span>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-text-muted">{label}</span>
      <span className="tabular text-text">{value}</span>
    </div>
  );
}

interface ExtraRow { name: string; amount: string; }

function ExtrasCostSection({
  extras,
  t,
  onAdd,
  onChange,
  onRemove,
}: {
  extras: ExtraRow[];
  t: (key: string) => string;
  onAdd: () => void;
  onChange: (i: number, k: keyof ExtraRow, v: string) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="mt-4 pt-4 border-t border-border space-y-2">
      <div className="text-xs font-medium text-text-muted uppercase tracking-wide">{t('extraSection')}</div>
      {extras.map((row, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input
            placeholder={t('extraName')}
            value={row.name}
            onChange={(e) => onChange(i, 'name', e.target.value)}
            className="flex-1"
          />
          <Input
            type="number"
            placeholder={t('extraAmount')}
            value={row.amount}
            onChange={(e) => onChange(i, 'amount', e.target.value)}
            className="w-36"
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(i)} aria-label={t('extraRemove')}>
            <Trash2 className="h-4 w-4 text-text-faint" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" onClick={onAdd} className="gap-1.5 text-xs text-text-muted hover:text-text">
        <Plus className="h-3.5 w-3.5" />
        {t('extraAdd')}
      </Button>
    </div>
  );
}
