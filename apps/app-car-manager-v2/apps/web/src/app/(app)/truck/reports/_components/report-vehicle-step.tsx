'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, ChevronLeft, ChevronRight, Truck } from 'lucide-react';
import { Button, Card, cn } from '@car-v2/ui';
import { ReportStepper } from './report-stepper';

/**
 * Lập báo cáo · Bước 3 — choose which trucks of ONE region this report covers
 * (REQ-20260817). Only rendered for a non-consolidated scope (`regions=A,B`,
 * never `regions=ALL`) — the wizard loops this step once per selected region
 * before reaching Review, accumulating the choice into the `vf` query param
 * (`HCM:ALL;DONG_NAI:<id1>,<id2>`), same accumulate-then-push pattern as
 * `ReportRegionStep`. Bỏ qua / chọn hết → "ALL" for this region, which the
 * server (`resolveReportVehicleScope`) treats as no vehicle filter at all —
 * byte-for-byte the AS-IS behaviour before this feature.
 *
 * A vehicle NOT selected here keeps whatever an earlier report already froze
 * for it — it does not lose its numbers (REQ-20260817 BL-1); the warning below
 * says so explicitly since that is not obvious from the UI alone.
 */
export function ReportVehicleStep({
  month,
  regionsCsv,
  vfDone,
  region,
  regionLabel,
  vehicles,
  remaining,
}: {
  month: string;
  /** Every region selected at Bước 2, in canonical order — carried through
   * unchanged so the URL always names the full multi-region scope. */
  regionsCsv: string;
  /** Already-accumulated `vf` entries for regions processed before this one
   * (empty string if this is the first). */
  vfDone: string;
  /** The region this screen is choosing vehicles for. */
  region: string;
  regionLabel: string;
  vehicles: { id: string; plate: string }[];
  /** How many MORE regions still need a vehicle pick after this one — drives
   * the continue button's label. */
  remaining: number;
}) {
  const t = useTranslations('screens.truckReports');
  const tA = useTranslations('actions');
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((v) => v !== id) : [...s, id]));
  const allSelected = selected.length === 0 || selected.length === vehicles.length;

  const backHref = `/truck/reports/new?month=${month}&regions=${regionsCsv}${vfDone ? `&vf=${encodeURIComponent(vfDone)}` : ''}`;

  const cont = () => {
    const entry = allSelected ? `${region}:ALL` : `${region}:${selected.join(',')}`;
    const nextVf = vfDone ? `${vfDone};${entry}` : entry;
    router.push(`/truck/reports/new?month=${month}&regions=${regionsCsv}&vf=${encodeURIComponent(nextVf)}`);
  };

  return (
    <div className="space-y-5">
      <ReportStepper step={3} />

      <Card variant="outline" className="space-y-4 p-5">
        <div>
          <div className="text-sm font-semibold text-text">
            {t('vehicleStepTitle', { region: regionLabel })}
          </div>
          <div className="text-xs text-text-muted">{t('vehicleStepHint')}</div>
        </div>

        <button
          type="button"
          onClick={() => setSelected([])}
          aria-pressed={allSelected}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors',
            allSelected ? 'border-accent bg-accent-soft ring-1 ring-accent' : 'border-border hover:border-accent',
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
            <Truck className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-text">
              {t('vehicleAll', { n: vehicles.length })}
            </div>
          </div>
          <CheckBox on={allSelected} />
        </button>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {vehicles.map((v) => {
            const isSel = !allSelected && selected.includes(v.id);
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => toggle(v.id)}
                aria-pressed={isSel}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-4 text-left transition-colors',
                  isSel ? 'border-accent bg-accent-soft ring-1 ring-accent' : 'border-border hover:border-accent',
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-muted">
                  <Truck className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1 font-mono text-sm font-semibold text-text">{v.plate}</div>
                <CheckBox on={isSel} />
              </button>
            );
          })}
        </div>

        {!allSelected && (
          <p className="text-xs text-text-faint">{t('vehicleUnselectedHint')}</p>
        )}

        <div className="flex items-center justify-between">
          <Button variant="ghost" size="md" onClick={() => router.push(backHref)}>
            <ChevronLeft className="h-4 w-4" />
            {tA('back')}
          </Button>
          <Button variant="accent" size="md" onClick={cont}>
            {remaining > 0 ? t('vehicleContinueNext', { n: remaining }) : tA('continue')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}

function CheckBox({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
        on ? 'border-accent bg-accent text-white' : 'border-border bg-surface',
      )}
    >
      {on && <Check className="h-3.5 w-3.5" />}
    </span>
  );
}
