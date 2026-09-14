'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, Info, Loader2, Lock, Save, Trash2 } from 'lucide-react';
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
  createTruckMaintenanceAction,
  deleteTruckMaintenanceAction,
  previewTruckMaintenanceConflictsAction,
  updateTruckMaintenanceAction,
  type TruckMaintenanceConflictPreview,
} from '@/server/actions/maintenance/truck-maintenance.actions';
import { MoneyInput } from '@/components/inputs/money-input';
import { formatActionError } from '@/lib/format-action-error';
import { formatDayKey } from '@/lib/format-day';

export interface MaintenanceVehicleOption {
  id: string;
  plate: string;
  /** "plate · model" for the Select. */
  label: string;
}

export interface TruckMaintenanceFormInitial {
  vehicleId: string;
  /** 'YYYY-MM-DD' */
  startDate: string;
  endDate: string;
  /** Raw digit string for MoneyInput ('' = 0). */
  cost: string;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Create / edit one truck maintenance job (REQ-20260904).
 *
 * Conflict handling follows user decision Q5 — "cảnh báo và chặn, show cảnh
 * báo ngay khi mở lên, chặn chọn": as soon as truck + dates are set (and on
 * mount when editing) the form asks the server which trucks already have trips
 * in the window; those trucks are greyed out in the Select, the picked one
 * shows the conflicting trip refs immediately, and Save is disabled. The save
 * action re-checks on the server anyway (CAR-E1014).
 */
export function TruckMaintenanceForm({
  maintenanceId,
  initial,
  vehicles,
  locked = false,
}: {
  maintenanceId?: string;
  initial?: TruckMaintenanceFormInitial;
  vehicles: MaintenanceVehicleOption[];
  /** Accounting month is closed (legacy chốt sổ) → read-only. */
  locked?: boolean;
}) {
  const t = useTranslations('screens.truckMaintenance.form');
  const tErr = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState<TruckMaintenanceFormInitial>({
    vehicleId: '',
    startDate: todayIso(),
    endDate: todayIso(),
    cost: '',
    ...initial,
  });

  /* Server-side conflict preview — debounced, latest-wins. */
  const [preview, setPreview] = useState<TruckMaintenanceConflictPreview>({ busy: {}, overlaps: [] });
  const [checking, setChecking] = useState(false);
  const seq = useRef(0);

  const datesValid = ISO_DAY.test(f.startDate) && ISO_DAY.test(f.endDate) && f.endDate >= f.startDate;

  useEffect(() => {
    if (!datesValid) {
      setPreview({ busy: {}, overlaps: [] });
      setChecking(false);
      return;
    }
    const mine = ++seq.current;
    setChecking(true);
    const handle = setTimeout(async () => {
      const res = await previewTruckMaintenanceConflictsAction({
        start_date: f.startDate,
        end_date: f.endDate,
        vehicle_id: f.vehicleId || undefined,
        exclude_id: maintenanceId,
      });
      if (mine !== seq.current) return; // a newer request superseded this one
      setChecking(false);
      if (res.success) setPreview(res.data);
    }, 300);
    return () => clearTimeout(handle);
  }, [f.startDate, f.endDate, f.vehicleId, datesValid, maintenanceId]);

  const loc = locale === 'ko' ? 'ko-KR' : locale === 'en' ? 'en-US' : 'vi-VN';
  const fmtDay = (iso: string) => formatDayKey(iso, loc);
  /* Plain MM/YYYY — the i18n string already says "tháng {month}", and vi-VN's
   * locale month format ("tháng 09, 2026") would double the word. */
  const monthLabel = datesValid ? `${f.startDate.slice(5, 7)}/${f.startDate.slice(0, 4)}` : '';

  const selectedVehicle = vehicles.find((v) => v.id === f.vehicleId);
  const selectedBusy = f.vehicleId ? preview.busy[f.vehicleId] : undefined;
  const blocked = !!selectedBusy && selectedBusy.count > 0;
  const canSave = !locked && !pending && !checking && datesValid && f.vehicleId !== '' && !blocked;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    startTransition(async () => {
      const payload = {
        vehicle_id: f.vehicleId,
        start_date: f.startDate,
        end_date: f.endDate,
        cost: f.cost.trim() === '' ? 0 : Number(f.cost),
      };
      const res = maintenanceId
        ? await updateTruckMaintenanceAction({ ...payload, maintenance_id: maintenanceId })
        : await createTruckMaintenanceAction(payload);
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      toast.success(t(maintenanceId ? 'updatedToast' : 'createdToast', { plate: selectedVehicle?.plate ?? '' }));
      router.push('/truck/maintenance');
      router.refresh();
    });
  };

  const del = () => {
    if (!maintenanceId || !confirm(t('deleteConfirm'))) return;
    startTransition(async () => {
      const res = await deleteTruckMaintenanceAction({ maintenance_id: maintenanceId });
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      toast.success(t('deletedToast'));
      router.push('/truck/maintenance');
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
        <form onSubmit={submit} noValidate className="space-y-4">
          {locked && (
            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2.5 text-sm text-text">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <span>{t('lockedHint')}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t('vehicle')} required className="sm:col-span-2">
              <Select
                value={f.vehicleId}
                onValueChange={(v) => setF((s) => ({ ...s, vehicleId: v }))}
                disabled={locked}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('selectVehicle')} />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => {
                    /* Truck already has trips in the chosen window → not
                     * selectable (user decision Q5). Stays enabled for the
                     * truck currently picked so the warning below can name
                     * the trips instead of the Select going blank. */
                    const busy = preview.busy[v.id];
                    const disabled = !!busy && busy.count > 0 && v.id !== f.vehicleId;
                    return (
                      <SelectItem key={v.id} value={v.id} disabled={disabled}>
                        {busy && busy.count > 0 ? `${v.label} ${t('vehicleBusySuffix', { n: busy.count })}` : v.label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </Field>

            <Field label={t('startDate')} required>
              <Input
                type="date"
                value={f.startDate}
                disabled={locked}
                onChange={(e) => {
                  const v = e.target.value;
                  /* Keep end ≥ start — a one-day job is the common case. */
                  setF((s) => ({ ...s, startDate: v, endDate: !s.endDate || s.endDate < v ? v : s.endDate }));
                }}
              />
            </Field>
            <Field label={t('endDate')} required>
              <Input
                type="date"
                value={f.endDate}
                min={f.startDate || undefined}
                disabled={locked}
                onChange={(e) => setF((s) => ({ ...s, endDate: e.target.value }))}
              />
              {f.startDate && f.endDate && f.endDate < f.startDate && (
                <p className="mt-1 text-xs text-danger">{t('endBeforeStart')}</p>
              )}
            </Field>

            <Field label={t('cost')} className="sm:col-span-2">
              {locked ? (
                <Input value={f.cost ? Number(f.cost).toLocaleString(loc) : '0'} disabled />
              ) : (
                <MoneyInput value={f.cost} onChange={(raw) => setF((s) => ({ ...s, cost: raw }))} placeholder="0" />
              )}
            </Field>
          </div>

          {/* What the numbers will do + what gets blocked. */}
          {datesValid && (
            <div className="flex items-start gap-2 rounded-md border border-border bg-surface-2/50 px-3 py-2.5 text-xs text-text-muted leading-relaxed">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-text-faint" />
              <span>
                {t('monthHint', { month: monthLabel })}{' '}
                {t('blockHint', { start: fmtDay(f.startDate), end: fmtDay(f.endDate) })}
              </span>
            </div>
          )}

          {/* HARD conflict — trips already on those days (CAR-E1014). */}
          {blocked && selectedBusy && (
            <div className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger-soft px-3 py-2.5 text-sm text-text">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
              <span>
                {t('tripsBlocked', {
                  plate: selectedVehicle?.plate ?? '',
                  count: selectedBusy.count,
                  refs: selectedBusy.refs.join(', '),
                })}
              </span>
            </div>
          )}

          {/* SOFT — another job of the same truck overlaps; allowed. */}
          {!blocked && preview.overlaps.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2.5 text-sm text-text">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <span>
                {t('overlapMaintenanceWarning', {
                  ranges: preview.overlaps.map((o) => `${fmtDay(o.startDate)}–${fmtDay(o.endDate)}`).join(', '),
                })}
              </span>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t border-border">
            {maintenanceId && (
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={del}
                disabled={pending || locked}
                className="w-full sm:w-auto sm:mr-auto text-danger hover:text-danger hover:bg-danger-soft"
                iconLeft={<Trash2 className="h-4 w-4" />}
              >
                {t('delete')}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => router.push('/truck/maintenance')}
              disabled={pending}
              className="w-full sm:w-auto"
            >
              {t('cancel')}
            </Button>
            <Button type="submit" variant="accent" size="lg" disabled={!canSave} className="w-full sm:w-auto">
              {pending || checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label>
        {label} {required && <span className="text-danger">*</span>}
      </Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
