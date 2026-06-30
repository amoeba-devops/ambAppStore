'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Check, ChevronDown, ChevronLeft, Loader2, Lock, Truck } from 'lucide-react';
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
 * Lập báo cáo · Bước 2 — per-vehicle review + confirm (matches the design).
 * Each truck card shows 6 summary stats then its trips. The four cost columns
 * (cầu đường / phát sinh / phí xăng / doanh thu) are editable on an OPEN month;
 * "Lập báo cáo" persists any edits (patchTruckTripCostsAction) then generates the
 * single Chi-phí-&-lợi-nhuận report. Closed months are read-only (trips locked).
 */
export function ReportReviewStep({ review }: { review: TruckReportReview }) {
  const t = useTranslations('screens.truckReports');
  const tA = useTranslations('actions');
  const tErr = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const loc = bcp47(locale);
  const [pending, start] = useTransition();

  const vnd = (n: number) => Math.round(n).toLocaleString(loc) + ' ₫';
  const dateStr = (d: Date) => new Date(d).toLocaleDateString(loc);
  const monthLabel = new Date(`${review.month}-01T00:00:00Z`).toLocaleDateString(loc, {
    month: 'long',
    year: 'numeric',
  });

  const editable = !review.closed;
  const [edits, setEdits] = useState<Record<string, Edit>>(() => {
    const m: Record<string, Edit> = {};
    for (const v of review.vehicles)
      for (const tr of v.trips) m[tr.trpId] = { toll: tr.toll, extra: tr.extra, fuel: tr.fuelCost, revenue: tr.revenue };
    return m;
  });
  const [openVeh, setOpenVeh] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const v of review.vehicles) m[v.vehicleId ?? '∅'] = true;
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

  const generate = () =>
    start(async () => {
      /* 1. Persist any cost edits (open month only). */
      if (editable) {
        for (const v of review.vehicles) {
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
      /* 2. Generate the single Chi-phí-&-lợi-nhuận report for the month. */
      const res = await generateTruckReportAction({ month: review.month, type: 'PNL' });
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      toast.success(t('createdToast', { month: monthLabel }));
      router.push('/truck/reports');
      router.refresh();
    });

  const numCell = (trpId: string, k: keyof Edit, fallback: number, width: string) =>
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
    <div className="max-w-5xl space-y-5">
      <ReportStepper step={2} />

      <div>
        <div className="text-sm font-semibold text-text">{t('step2Title')}</div>
        <div className="text-xs text-text-muted">
          <span className="capitalize">{monthLabel}</span> · {t('reviewSubtitle')}
        </div>
      </div>

      {review.closed && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-text-muted">
          <Lock className="h-3.5 w-3.5" />
          {t('closedNote')}
        </div>
      )}
      {editable && <p className="text-xs text-text-faint">{t('editHint')}</p>}

      {review.vehicles.length === 0 ? (
        <Card className="p-6 text-center text-sm text-text-muted">{t('emptyMonth')}</Card>
      ) : (
        review.vehicles.map((v) => {
          const key = v.vehicleId ?? '∅';
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
                  {/* 6 summary stats (design: 3-col grid; fleet-level fuel figures
                      repeat per card since our model reconciles fuel monthly). */}
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
                            <td className="px-3 py-2 text-right">{numCell(tr.trpId, 'toll', tr.toll, 'w-24')}</td>
                            <td className="px-3 py-2 text-right">{numCell(tr.trpId, 'extra', tr.extra, 'w-24')}</td>
                            <td className="px-3 py-2 text-right">{numCell(tr.trpId, 'fuel', tr.fuelCost, 'w-24')}</td>
                            <td className="px-3 py-2 text-right">{numCell(tr.trpId, 'revenue', tr.revenue, 'w-28')}</td>
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

      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" size="md" onClick={() => router.push('/truck/reports/new')} disabled={pending}>
          <ChevronLeft className="h-4 w-4" />
          {tA('back')}
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={generate}
          disabled={pending || review.vehicles.length === 0}
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
