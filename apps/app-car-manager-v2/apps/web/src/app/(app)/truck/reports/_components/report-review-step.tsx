'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Check, ChevronDown, ChevronLeft, Loader2, Lock, MapPin, Truck } from 'lucide-react';
import { Badge, Button, Card, cn, toast } from '@car-v2/ui';
import { generateTruckReportAction } from '@/server/actions/truck-report.actions';
import { patchTruckTripCostsAction } from '@/server/actions/trips/truck-trip.actions';
import { formatActionError } from '@/lib/format-action-error';
import type { TruckReportReview } from '@/server/queries/truck-finance.queries';
import { ReportStepper } from './report-stepper';

function bcp47(locale: string): string {
  if (locale === 'vi') return 'vi-VN';
  if (locale === 'ko') return 'ko-KR';
  return 'en-US';
}

type Edit = { toll: number; extra: number; fuel: number; revenue: number };

/**
 * Lập báo cáo · Bước 3 — per-region, per-vehicle review + confirm. One section
 * per selected region (each with its own open/closed lock + fuel reconciliation);
 * the four cost columns are editable on an OPEN region only. "Lập báo cáo" persists
 * any edits (patchTruckTripCostsAction) then generates one Chi-phí-&-lợi-nhuận
 * report per region (one row + one Excel each).
 */
export function ReportReviewStep({ reviews }: { reviews: TruckReportReview[] }) {
  const t = useTranslations('screens.truckReports');
  const tA = useTranslations('actions');
  const tErr = useTranslations();
  const tRegion = useTranslations('region');
  const router = useRouter();
  const locale = useLocale();
  const loc = bcp47(locale);
  const [pending, start] = useTransition();
  /* Report format (REQ-20260713): default to the client "Tổng kết chi phí tháng"
   * single-sheet template; "Chi tiết đầy đủ" = the legacy 3-sheet PNL workbook. */
  const [fmt, setFmt] = useState<'MONTHLY_SUMMARY' | 'PNL'>('MONTHLY_SUMMARY');

  const month = reviews[0]?.month ?? '';
  const vnd = (n: number) => Math.round(n).toLocaleString(loc) + ' ₫';
  const dateStr = (d: Date) => new Date(d).toLocaleDateString(loc);
  const monthLabel = month
    ? new Date(`${month}-01T00:00:00Z`).toLocaleDateString(loc, { month: 'long', year: 'numeric' })
    : '';
  const regionLabel = (r: string | null) => (r ? tRegion(r) : t('regionAll'));
  const multi = reviews.length > 1;

  const [edits, setEdits] = useState<Record<string, Edit>>(() => {
    const m: Record<string, Edit> = {};
    for (const rv of reviews)
      for (const v of rv.vehicles)
        for (const tr of v.trips)
          m[tr.trpId] = { toll: tr.toll, extra: tr.extra, fuel: tr.fuelCost, revenue: tr.revenue };
    return m;
  });
  const [openVeh, setOpenVeh] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const rv of reviews) for (const v of rv.vehicles) m[`${rv.region ?? '∅'}:${v.vehicleId ?? '∅'}`] = true;
    return m;
  });

  const setField = (trpId: string, k: keyof Edit, raw: string) => {
    const n = Math.max(0, Math.round(Number(raw) || 0));
    setEdits((s) => ({
      ...s,
      [trpId]: { ...(s[trpId] ?? { toll: 0, extra: 0, fuel: 0, revenue: 0 }), [k]: n },
    }));
  };

  /* Live per-vehicle recompute from the edited values. */
  const vsum = (v: TruckReportReview['vehicles'][number]) => {
    let revenue = 0;
    let toll = 0;
    let fuel = 0;
    let extra = 0;
    for (const tr of v.trips) {
      const e = edits[tr.trpId];
      revenue += e?.revenue ?? tr.revenue;
      toll += e?.toll ?? tr.toll;
      fuel += e?.fuel ?? tr.fuelCost;
      extra += e?.extra ?? tr.extra;
    }
    return { revenue, toll, fuel, extra, net: revenue - fuel - toll - extra - v.fixedCost };
  };

  const totalVehicles = reviews.reduce((n, r) => n + r.vehicles.length, 0);

  const generate = () =>
    start(async () => {
      /* 1. Persist any cost edits — open regions only (closed regions are locked
       *    server-side too, so we skip them here to avoid a rejected patch). */
      for (const rv of reviews) {
        if (rv.closed) continue;
        for (const v of rv.vehicles) {
          for (const tr of v.trips) {
            const e = edits[tr.trpId];
            if (!e) continue;
            const payload: Record<string, unknown> = { trip_id: tr.trpId };
            if (e.toll !== tr.toll) payload.toll_fee = e.toll;
            if (e.revenue !== tr.revenue) payload.revenue = e.revenue;
            if (e.extra !== tr.extra) payload.extra_amount = e.extra;
            if (e.fuel !== tr.fuelCost) payload.fuel_cost = e.fuel;
            if (Object.keys(payload).length === 1) continue; // nothing changed
            const res = await patchTruckTripCostsAction(payload);
            if (!res.success) {
              toast.error(formatActionError(res.error, tErr));
              return;
            }
          }
        }
      }
      /* 2. Generate one report per selected region in the chosen format. */
      const regions = reviews.filter((r) => r.vehicles.length > 0).map((r) => r.region);
      for (const region of regions) {
        const res = await generateTruckReportAction({ month, region, type: fmt });
        if (!res.success) {
          toast.error(formatActionError(res.error, tErr));
          return;
        }
      }
      toast.success(
        regions.length > 1
          ? t('createdToastRegions', { n: regions.length, month: monthLabel })
          : t('createdToast', { month: monthLabel }),
      );
      router.push('/truck/reports');
      router.refresh();
    });

  const numCell = (trpId: string, k: keyof Edit, fallback: number, width: string, editable: boolean) =>
    editable ? (
      <input
        type="number"
        min={0}
        value={edits[trpId]?.[k] ?? fallback}
        onChange={(ev) => setField(trpId, k, ev.target.value)}
        className={cn(
          'rounded border border-border bg-surface px-2 py-1 text-right tabular focus:border-accent focus:outline-none',
          width,
        )}
      />
    ) : (
      <span className="tabular text-text-muted">{vnd(fallback)}</span>
    );

  return (
    <div className="space-y-5">
      <ReportStepper step={3} />

      <div>
        <div className="text-sm font-semibold text-text">{t('step2Title')}</div>
        <div className="text-xs text-text-muted">
          <span className="capitalize">{monthLabel}</span> ·{' '}
          <span className="font-medium text-text">
            {multi ? t('nRegions', { n: reviews.length }) : regionLabel(reviews[0]?.region ?? null)}
          </span>{' '}
          · {t('reviewSubtitle')}
        </div>
      </div>

      {/* Report format picker (REQ-20260713) — Monthly Summary (client template)
          vs the detailed 3-sheet PNL. */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium uppercase tracking-wider text-text-faint">
          {t('selectFormat')}
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(['MONTHLY_SUMMARY', 'PNL'] as const).map((opt) => {
            const active = fmt === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setFmt(opt)}
                disabled={pending}
                aria-pressed={active}
                className={cn(
                  'flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors',
                  active ? 'border-accent bg-accent/5 ring-1 ring-accent' : 'border-border hover:bg-surface-2',
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded-full border',
                      active ? 'border-accent' : 'border-border',
                    )}
                  >
                    {active && <span className="h-2 w-2 rounded-full bg-accent" />}
                  </span>
                  <span className="text-sm font-semibold text-text">
                    {opt === 'MONTHLY_SUMMARY' ? t('type_MONTHLY_SUMMARY') : t('type_PNL')}
                  </span>
                </div>
                <span className="pl-6 text-xs text-text-muted">
                  {opt === 'MONTHLY_SUMMARY' ? t('formatSummaryHint') : t('formatDetailHint')}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {reviews.map((review) => {
        const editable = !review.closed;
        /* Reconciliation computable → fuel is auto-allocated (km × consumption
         * × avg price); the fuel column is read-only so a hand edit can't be
         * silently overwritten by the recompute at generation. */
        const fuelEditable = editable && !review.allocatable;
        return (
          <section key={review.region ?? '∅'} className="space-y-3">
            {/* Region section header — only shown when more than one region is
                selected; a single-region report doesn't need the divider. */}
            {multi && (
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <MapPin className="h-4 w-4 text-accent" />
                <span className="text-sm font-semibold text-text">{regionLabel(review.region)}</span>
                <Badge tone={review.closed ? 'neutral' : 'success'} size="sm">
                  {review.closed ? t('statusDone') : t('statusOpen')}
                </Badge>
              </div>
            )}

            {review.closed && (
              <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-text-muted">
                <Lock className="h-3.5 w-3.5" />
                {t('closedNote')}
              </div>
            )}

            {/* Fuel mode — allocated (official formula) vs manual fallback. */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={review.allocatable ? 'success' : 'warning'} size="sm">
                {review.allocatable ? t('modeAllocated') : t('modeManual')}
              </Badge>
              <span className="text-xs text-text-faint">
                {review.allocatable ? t('modeAllocatedHint') : t('modeManualHint')}
              </span>
            </div>
            {review.allocatable && review.kmZeroCount > 0 && (
              <div className="rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-text">
                {t('kmZeroWarn', { n: review.kmZeroCount })}
              </div>
            )}
            {editable && <p className="text-xs text-text-faint">{t('editHint')}</p>}

            {review.vehicles.length === 0 ? (
              <Card className="p-6 text-center text-sm text-text-muted">{t('emptyMonth')}</Card>
            ) : (
              review.vehicles.map((v) => {
                const key = `${review.region ?? '∅'}:${v.vehicleId ?? '∅'}`;
                const sum = vsum(v);
                const isOpen = openVeh[key] ?? true;
                return (
                  <Card key={key} variant="outline" className="overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenVeh((s) => ({ ...s, [key]: !isOpen }))}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2"
                    >
                      <ChevronDown className={cn('h-4 w-4 shrink-0 text-text-faint transition-transform', !isOpen && '-rotate-90')} />
                      <Truck className="h-4 w-4 shrink-0 text-accent" />
                      <span className="font-mono font-semibold text-text">{v.plate}</span>
                      {v.model && <span className="truncate text-xs text-text-muted">{v.model}</span>}
                    </button>

                    {isOpen && (
                      <div className="border-t border-border">
                        <div className="grid grid-cols-2 gap-3 border-b border-border bg-surface-2/40 p-4 sm:grid-cols-3">
                          <Stat label={t('cardTrips')} value={String(v.tripCount)} />
                          <Stat label={t('cardFuel')} value={vnd(sum.fuel)} />
                          <Stat label={t('cardRefuels')} value={String(review.refuelCount)} />
                          <Stat label={t('cardAvgPrice')} value={`${review.avgPrice.toLocaleString(loc)} ₫/L`} />
                          <Stat label={t('cardConsumption')} value={`${review.consumption.toFixed(3)} L/km`} />
                          <Stat label={t('cardFixed')} value={vnd(v.fixedCost)} />
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-faint">
                                <th className="px-3 py-2 font-medium">{t('thStt')}</th>
                                <th className="px-3 py-2 font-medium">{t('thDate')}</th>
                                <th className="px-3 py-2 font-medium">{t('thCustomer')}</th>
                                <th className="px-3 py-2 text-right font-medium">{t('thKm')}</th>
                                <th className="px-3 py-2 text-right font-medium">{t('thToll')}</th>
                                <th className="px-3 py-2 text-right font-medium">{t('thExtra')}</th>
                                <th className="px-3 py-2 text-right font-medium">{t('thFuelTrip')}</th>
                                <th className="px-3 py-2 text-right font-medium">{t('thRevenue')}</th>
                                <th className="px-3 py-2 font-medium">{t('thStatus')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {v.trips.map((tr, i) => (
                                <tr key={tr.trpId} className="border-b border-border/60 last:border-0">
                                  <td className="px-3 py-2 font-mono text-text-faint">{i + 1}</td>
                                  <td className="whitespace-nowrap px-3 py-2 text-text-muted">{dateStr(tr.scheduledAt)}</td>
                                  <td className="px-3 py-2 text-text">{tr.customer ?? '—'}</td>
                                  <td className="px-3 py-2 text-right tabular">{tr.km.toLocaleString(loc)}</td>
                                  <td className="px-3 py-2 text-right">{numCell(tr.trpId, 'toll', tr.toll, 'w-24', editable)}</td>
                                  <td className="px-3 py-2 text-right">{numCell(tr.trpId, 'extra', tr.extra, 'w-24', editable)}</td>
                                  <td className="px-3 py-2 text-right">{numCell(tr.trpId, 'fuel', tr.fuelCost, 'w-24', fuelEditable)}</td>
                                  <td className="px-3 py-2 text-right">{numCell(tr.trpId, 'revenue', tr.revenue, 'w-28', editable)}</td>
                                  <td className="px-3 py-2">
                                    <Badge tone={tr.finalized ? 'success' : 'neutral'} size="sm">
                                      {tr.finalized ? t('statusDone') : t('statusOpen')}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </section>
        );
      })}

      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" size="md" onClick={() => router.push(`/truck/reports/new?month=${month}`)} disabled={pending}>
          <ChevronLeft className="h-4 w-4" />
          {tA('back')}
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={generate}
          disabled={pending || totalVehicles === 0}
          className="bg-success text-white hover:bg-success/90 active:bg-success/80"
          iconLeft={pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        >
          {t('generateBtn')}
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="text-[11px] uppercase tracking-wider text-text-faint">{label}</div>
      <div className="text-sm font-semibold tabular text-text">{value}</div>
    </div>
  );
}
