'use client';

import { useEffect, useMemo, useRef } from 'react';
import { AlertTriangle, AlertCircle, Calculator } from 'lucide-react';
import { cn } from '@v2/ui';
import type { SelectedPeriod } from './Step1Period';

// All 11 fields the user must enter
export type ManualFieldKey =
  | 'affiliateBookingFees'
  | 'shopeeLivestreamFees'
  | 'tiktokLivestreamFees'
  | 'tiktokAdsSpending'
  | 'tiktokPfTransaction'
  | 'tiktokPfCommission'
  | 'tiktokPfSellerShipping'
  | 'tiktokPfExclusiveBenefit'
  | 'tiktokPfVoucherXtra'
  | 'tiktokPfOrderProcessing'
  | 'tiktokPfSfrService';

export type ManualInputs = Record<ManualFieldKey, string>;

export const ALL_MANUAL_FIELDS: ManualFieldKey[] = [
  'affiliateBookingFees',
  'shopeeLivestreamFees',
  'tiktokLivestreamFees',
  'tiktokAdsSpending',
  'tiktokPfTransaction',
  'tiktokPfCommission',
  'tiktokPfSellerShipping',
  'tiktokPfExclusiveBenefit',
  'tiktokPfVoucherXtra',
  'tiktokPfOrderProcessing',
  'tiktokPfSfrService',
];

export const FIELD_LABELS: Record<ManualFieldKey, string> = {
  affiliateBookingFees: 'Total Affiliate Booking Fee',
  shopeeLivestreamFees: 'Total Livestream Fee — Shopee',
  tiktokLivestreamFees: 'Total Livestream Fee — TikTok',
  tiktokAdsSpending: 'Total Ad Spending — TikTok',
  tiktokPfTransaction: 'Transaction Fee',
  tiktokPfCommission: 'TikTok Shop Commission',
  tiktokPfSellerShipping: 'Seller Shipping Fee',
  tiktokPfExclusiveBenefit: 'Exclusive Benefit Access Fee',
  tiktokPfVoucherXtra: 'Voucher Xtra Service Fee',
  tiktokPfOrderProcessing: 'Order Processing Fee',
  tiktokPfSfrService: 'SFR Service Fee',
};

const PLATFORM_FEE_KEYS: ManualFieldKey[] = [
  'tiktokPfTransaction',
  'tiktokPfCommission',
  'tiktokPfSellerShipping',
  'tiktokPfExclusiveBenefit',
  'tiktokPfVoucherXtra',
  'tiktokPfOrderProcessing',
  'tiktokPfSfrService',
];

export function emptyManualInputs(): ManualInputs {
  return ALL_MANUAL_FIELDS.reduce((acc, k) => {
    acc[k] = '';
    return acc;
  }, {} as ManualInputs);
}

interface Props {
  values: ManualInputs;
  onChange: (next: ManualInputs) => void;
  attempted?: boolean;
  selectedPeriod?: SelectedPeriod | null;
}

function isFilled(v: string): boolean {
  if (v == null || v.trim() === '') return false;
  // "0" is a valid value; check non-empty numeric
  return /^-?\d+(\.\d+)?$/.test(v.trim());
}

export function Step3ManualInput({ values, onChange, attempted = false, selectedPeriod = null }: Props) {
  const platformFeeTotal = useMemo(
    () =>
      PLATFORM_FEE_KEYS.reduce((sum, k) => {
        const n = Number(values[k]);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0),
    [values],
  );

  const missing = ALL_MANUAL_FIELDS.filter((k) => !isFilled(values[k]));
  const showError = attempted && missing.length > 0;
  const errorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (showError && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showError, missing.length]);

  const set = (k: ManualFieldKey, v: string) => {
    onChange({ ...values, [k]: v });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-neutral-900">Step 3 · Manual Input</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Enter the costs that aren&apos;t captured in the uploaded raw files. All amounts in VND.
        </p>
      </div>

      {selectedPeriod && (
        <div className="rounded-md bg-info-50/40 border border-info-500/30 px-3 py-2 text-xs text-info-500">
          Manual costs apply to{' '}
          <span className="font-mono font-semibold">{selectedPeriod.label}</span>{' '}
          <span className="text-neutral-500">({selectedPeriod.rangeLabel})</span>.
        </div>
      )}

      {showError && (
        <div ref={errorRef} className="rounded-md border border-error-500 bg-error-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-error-500" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-error-500">
                {missing.length} field{missing.length > 1 ? 's' : ''} missing — fill all to continue
              </div>
              <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs text-error-500 sm:grid-cols-2">
                {missing.map((k) => (
                  <li key={k} className="flex items-center gap-1">
                    <AlertCircle className="h-2.5 w-2.5" />
                    {FIELD_LABELS[k]}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Total Platform group */}
      <SectionGroup title="Total Platform" badge="Σ" badgeClass="bg-info-500 text-white">
        <FieldRow
          label={FIELD_LABELS.affiliateBookingFees}
          value={values.affiliateBookingFees}
          onChange={(v) => set('affiliateBookingFees', v)}
          invalid={attempted && !isFilled(values.affiliateBookingFees)}
          hint="Affiliate booking fee shared across Shopee + TikTok"
        />
      </SectionGroup>

      {/* Shopee group */}
      <SectionGroup title="Shopee" badge="S" badgeClass="bg-shopee text-white">
        <FieldRow
          label={FIELD_LABELS.shopeeLivestreamFees}
          value={values.shopeeLivestreamFees}
          onChange={(v) => set('shopeeLivestreamFees', v)}
          invalid={attempted && !isFilled(values.shopeeLivestreamFees)}
        />
      </SectionGroup>

      {/* TikTok group */}
      <SectionGroup title="TikTok Shop" badge="T" badgeClass="bg-neutral-900 text-white">
        <FieldRow
          label={FIELD_LABELS.tiktokLivestreamFees}
          value={values.tiktokLivestreamFees}
          onChange={(v) => set('tiktokLivestreamFees', v)}
          invalid={attempted && !isFilled(values.tiktokLivestreamFees)}
        />
        <FieldRow
          label={FIELD_LABELS.tiktokAdsSpending}
          value={values.tiktokAdsSpending}
          onChange={(v) => set('tiktokAdsSpending', v)}
          invalid={attempted && !isFilled(values.tiktokAdsSpending)}
        />

        {/* Platform Fee subgroup */}
        <div className="rounded-md border border-neutral-200 bg-neutral-50/60 p-3 mt-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-neutral-500" />
              <span className="text-sm font-semibold text-neutral-900">Platform Fee</span>
              <span className="text-[10px] uppercase tracking-wider text-neutral-400">auto-computed</span>
            </div>
            <span className="font-mono text-sm font-semibold tabular-nums text-info-500">
              {new Intl.NumberFormat('en-US').format(Math.round(platformFeeTotal))} VND
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PLATFORM_FEE_KEYS.map((k) => (
              <FieldRow
                key={k}
                label={FIELD_LABELS[k]}
                value={values[k]}
                onChange={(v) => set(k, v)}
                invalid={attempted && !isFilled(values[k])}
                compact
                indent
              />
            ))}
          </div>
          <div className="mt-2 text-[11px] text-neutral-500">
            Platform Fee = sum of the 7 fees above
          </div>
        </div>
      </SectionGroup>
    </div>
  );
}

function SectionGroup({
  title,
  badge,
  badgeClass,
  children,
}: {
  title: string;
  badge: string;
  badgeClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 space-y-2">
      <div className="flex items-center gap-2 border-b border-neutral-100 pb-2">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
            badgeClass,
          )}
        >
          <span className="font-mono">{badge}</span>
          {title}
        </span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function FieldRow({
  label,
  value,
  onChange,
  invalid,
  hint,
  compact,
  indent,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  hint?: string;
  compact?: boolean;
  indent?: boolean;
}) {
  return (
    <label
      className={cn(
        'flex items-center justify-between gap-3 rounded-md border bg-white px-3 transition-colors',
        compact ? 'py-1.5' : 'py-2',
        invalid ? 'border-error-500 bg-error-50/30' : 'border-neutral-200',
      )}
    >
      <span className="flex flex-col">
        <span
          className={cn(
            indent && 'before:content-["└"] before:mr-1.5 before:text-neutral-400',
            compact ? 'text-xs' : 'text-sm',
            'text-neutral-700',
          )}
        >
          {label}
        </span>
        {hint && <span className="text-[10px] text-neutral-400">{hint}</span>}
      </span>
      <span className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className={cn(
            'w-32 rounded border bg-white px-2 py-1 text-right font-mono text-sm tabular-nums text-neutral-900 focus:outline-none',
            invalid
              ? 'border-error-500 focus:border-error-500'
              : 'border-neutral-300 focus:border-neutral-500',
          )}
        />
        <span className="text-[10px] font-medium uppercase text-neutral-400">VND</span>
      </span>
    </label>
  );
}
