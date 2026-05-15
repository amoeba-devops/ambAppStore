'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Zap,
  Check,
  ArrowRight,
  Archive,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@v2/ui';
import { fmtVND } from '@/lib/format';
import {
  commitIngestAction,
  type CommitIngestResult,
} from '@/server/actions/ingest.actions';
import { slotKey } from './Step2Upload';
import type { SelectedPeriod } from './Step1Period';
import type { ManualInputs } from './Step3ManualInput';

interface Props {
  selectedPeriod?: SelectedPeriod | null;
  files?: Map<string, File>;
  manualInputs?: ManualInputs;
  tiktokPlatformFeeRatePct?: number;
}

/**
 * Maps Step 2 slot keys (e.g. "SHOPEE::SALES") to the form field names expected
 * by `commitIngestAction`.
 */
const SLOT_TO_FORM_FIELD: Record<string, string> = {
  [slotKey({ channel: 'SHOPEE', type: 'SALES' })]: 'shopee_sales',
  [slotKey({ channel: 'SHOPEE', type: 'ADS' })]: 'shopee_ads',
  [slotKey({ channel: 'SHOPEE', type: 'BRAND_ADS' })]: 'shopee_brand_ads',
  [slotKey({ channel: 'SHOPEE', type: 'OFF_PLATFORM_ADS' })]: 'shopee_off_platform_ads',
  [slotKey({ channel: 'SHOPEE', type: 'TRAFFIC' })]: 'shopee_traffic',
  [slotKey({ channel: 'SHOPEE', type: 'AFFILIATE' })]: 'shopee_affiliate',
  [slotKey({ channel: 'TIKTOK', type: 'SALES' })]: 'tiktok_sales',
  [slotKey({ channel: 'TIKTOK', type: 'TRAFFIC' })]: 'tiktok_traffic',
  [slotKey({ channel: 'TIKTOK', type: 'AFFILIATE' })]: 'tiktok_affiliate',
};

export function Step6Ingest({
  selectedPeriod = null,
  files,
  manualInputs,
  tiktokPlatformFeeRatePct = 24,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CommitIngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoTriggered, setAutoTriggered] = useState(false);

  const submit = () => {
    if (!selectedPeriod) {
      setError('No period selected — go back to Step 1');
      return;
    }
    setError(null);
    setResult(null);

    const fd = new FormData();
    fd.set('granularity', selectedPeriod.granularity === 'WEEK' ? 'WEEKLY' : 'MONTHLY');
    fd.set('periodStart', selectedPeriod.periodStartIso);
    fd.set('periodEnd', selectedPeriod.periodEndIso);
    fd.set('year', String(selectedPeriod.year));
    if (selectedPeriod.granularity === 'WEEK') fd.set('weekNum', String(selectedPeriod.periodId));
    else fd.set('monthIdx', String(selectedPeriod.periodId));

    // Files
    if (files) {
      for (const [slot, file] of files) {
        const field = SLOT_TO_FORM_FIELD[slot];
        if (field) fd.set(field, file);
      }
    }
    // Manual inputs
    if (manualInputs) {
      for (const [k, v] of Object.entries(manualInputs)) {
        const n = Number(v);
        if (Number.isFinite(n)) fd.set(k, String(n));
      }
    }
    fd.set('tiktokPlatformFeeRatePct', String(tiktokPlatformFeeRatePct));

    startTransition(async () => {
      const res = await commitIngestAction(fd);
      if (!res.success) {
        setError(`${res.error.code}: ${res.error.message}`);
        return;
      }
      setResult(res.data);
    });
  };

  // Auto-trigger ingest on mount (when user reaches Step 6 via Continue button).
  // Operator no longer has to click a second button — entering Step 6 = commit.
  useEffect(() => {
    if (autoTriggered) return;
    if (!selectedPeriod || !files || files.size === 0) return;
    setAutoTriggered(true);
    submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod, files, autoTriggered]);

  const periodLabel = selectedPeriod?.label ?? '—';
  const totalFiles = files?.size ?? 0;

  if (pending) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-info-50">
            <Loader2 className="h-6 w-6 text-info-500 animate-spin" />
          </div>
          <h2 className="text-base font-semibold text-neutral-900">Integrating files…</h2>
          <p className="text-xs text-neutral-500">
            Parsing {totalFiles} files for period{' '}
            <span className="font-mono">{periodLabel}</span>, computing metrics, persisting snapshot.
          </p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-neutral-200 bg-white px-6 py-8 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-info-50">
            <Zap className="h-6 w-6 text-info-500" />
          </div>
          <h2 className="mt-3 text-base font-semibold text-neutral-900">Ready to ingest</h2>
          <p className="mt-1 max-w-xl mx-auto text-sm text-neutral-500">
            Will parse {totalFiles} file{totalFiles !== 1 ? 's' : ''}, compute Shopee + TikTok metrics,
            and save a snapshot for period <span className="font-mono">{periodLabel}</span>.
          </p>
          <button
            type="button"
            onClick={submit}
            className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-info-500 px-4 py-2 text-sm font-semibold text-white hover:bg-info-500/90"
          >
            <Zap className="h-4 w-4" />
            Confirm ingest
          </button>
        </div>

        {error && (
          <div className="rounded-md border border-error-500 bg-error-50 px-4 py-3 text-sm text-error-500">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Complete
  const { metrics, isNew } = result;
  const totalCm =
    metrics.shopee.totalNetGmv -
    metrics.shopee.totalSellerDiscount -
    metrics.shopee.totalPrimeCost -
    metrics.shopee.totalAdSpending -
    metrics.shopee.totalBrandAds -
    metrics.shopee.totalPlatformFee -
    metrics.shopee.totalSellerVouchers -
    metrics.shopee.totalOffPlatformAds -
    metrics.shopee.totalAffiliateCommission -
    (manualInputs ? Number(manualInputs.shopeeLivestreamFees) || 0 : 0) +
    metrics.tiktok.totalNetGmv -
    metrics.tiktok.totalPrimeCost -
    metrics.tiktok.totalAffiliateCommission -
    (manualInputs ? Number(manualInputs.tiktokAdsSpending) || 0 : 0) -
    (manualInputs ? Number(manualInputs.tiktokLivestreamFees) || 0 : 0);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-white px-6 py-8 text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-success-500/10">
          <Check className="h-6 w-6 text-success-500" strokeWidth={3} />
        </div>
        <div className="mt-3 text-[10px] uppercase tracking-wider font-semibold text-success-500">
          {isNew ? 'Integration Complete' : 'Snapshot Updated'}
        </div>
        <h2 className="mt-1 text-xl font-semibold text-neutral-900">
          Period <span className="font-mono">{periodLabel}</span> is live
        </h2>
        <p className="mt-2 max-w-xl mx-auto text-sm text-neutral-500">
          Snapshot persisted to DB. Reports recomputed from your real upload.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <Link
            href={`/raw-archive/${encodeURIComponent(periodLabel)}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <Archive className="h-4 w-4" />
            View raw archive
          </Link>
          <Link
            href="/reports/weekly"
            className="inline-flex items-center gap-1.5 rounded-md bg-info-500 px-3 py-2 text-sm font-semibold text-white hover:bg-info-500/90"
          >
            Open Weekly Detail
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Shopee Net GMV" value={fmtVND(metrics.shopee.totalNetGmv)} />
        <StatTile label="TikTok Net GMV" value={fmtVND(metrics.tiktok.totalNetGmv)} />
        <StatTile
          label="Total Net GMV"
          value={fmtVND(metrics.shopee.totalNetGmv + metrics.tiktok.totalNetGmv)}
          highlight
        />
        <StatTile label="Total CM (estimate)" value={fmtVND(Math.round(totalCm))} highlight />
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-xs text-neutral-600">
        <strong className="text-neutral-900">CM estimate</strong> excludes per-product allocation
        (Phase B v2). Shopee includes Brand Ads / Off-Platform / Vouchers; TikTok uses rate-based
        Platform Fee + manual Ad Spending + Livestream.
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2',
        highlight ? 'border-info-500/30 bg-info-50/40' : 'border-neutral-200 bg-white',
      )}
    >
      <div className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-sm font-semibold text-neutral-900 tabular-nums">
        {value}
      </div>
    </div>
  );
}
