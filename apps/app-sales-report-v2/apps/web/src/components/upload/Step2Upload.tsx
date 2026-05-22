'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, X, RefreshCw, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@v2/ui';
import type { SelectedPeriod } from './Step1Period';
import { TotalGmvPreviewCard } from './TotalGmvPreviewCard';
import { TikTokMetricsPreviewCard } from './TikTokMetricsPreviewCard';

export type Channel = 'SHOPEE' | 'TIKTOK';
export type ReportType =
  | 'SALES'
  | 'ADS'
  | 'BRAND_ADS'
  | 'OFF_PLATFORM_ADS'
  | 'TRAFFIC'
  | 'AFFILIATE';

export interface ReportSlot {
  channel: Channel;
  type: ReportType;
  /** i18n key suffix under `uploadWizard.step2.slot.*` — pair Label + Subtitle keys. */
  slotKey: 'sales' | 'ads' | 'brandAds' | 'offPlatformAds' | 'traffic' | 'affiliate';
}

const SHOPEE_REPORTS: ReportSlot[] = [
  { channel: 'SHOPEE', type: 'SALES', slotKey: 'sales' },
  { channel: 'SHOPEE', type: 'ADS', slotKey: 'ads' },
  { channel: 'SHOPEE', type: 'BRAND_ADS', slotKey: 'brandAds' },
  { channel: 'SHOPEE', type: 'OFF_PLATFORM_ADS', slotKey: 'offPlatformAds' },
  { channel: 'SHOPEE', type: 'TRAFFIC', slotKey: 'traffic' },
  { channel: 'SHOPEE', type: 'AFFILIATE', slotKey: 'affiliate' },
];

const TIKTOK_REPORTS: ReportSlot[] = [
  { channel: 'TIKTOK', type: 'SALES', slotKey: 'sales' },
  { channel: 'TIKTOK', type: 'TRAFFIC', slotKey: 'traffic' },
  { channel: 'TIKTOK', type: 'AFFILIATE', slotKey: 'affiliate' },
];

export function slotKey(slot: { channel: Channel; type: ReportType }): string {
  return `${slot.channel}::${slot.type}`;
}

interface ExistingFileInfo {
  arfId: string;
  channel: 'SHOPEE' | 'TIKTOK';
  fileType: 'SALES' | 'ADS' | 'BRAND_ADS' | 'OFF_PLATFORM_ADS' | 'TRAFFIC' | 'AFFILIATE';
  filename: string;
  sizeBytes: number;
  rowCount: number | null;
  uploadedAt: string;
  uploadedBy: string;
  s3Key: string | null;
}

interface Props {
  selectedPeriod: SelectedPeriod | null;
  files: Map<string, File>;
  onFilesChange: (next: Map<string, File>) => void;
  attempted?: boolean;
  /** When Active period is selected, list of files already archived from the previous ingest. */
  existingFiles?: ExistingFileInfo[];
}

function fmtBytes(b: number): string {
  if (b >= 1_000_000) return `${(b / 1_000_000).toFixed(1)} MB`;
  if (b >= 1_000) return `${(b / 1_000).toFixed(1)} KB`;
  return `${b} B`;
}

export function Step2Upload({
  selectedPeriod,
  files,
  onFilesChange,
  attempted = false,
  existingFiles = [],
}: Props) {
  const t = useTranslations('uploadWizard.step2');
  const tSlot = useTranslations('uploadWizard.step2.slot');
  const slotLabel = (slot: ReportSlot) =>
    tSlot(`${slot.slotKey}Label` as `${ReportSlot['slotKey']}Label`);
  const slotSubtitle = (slot: ReportSlot) =>
    tSlot(`${slot.slotKey}Subtitle` as `${ReportSlot['slotKey']}Subtitle`);
  const onSetFile = (key: string, file: File | null) => {
    const next = new Map(files);
    if (file) next.set(key, file);
    else next.delete(key);
    onFilesChange(next);
  };

  const uploadedCount = files.size;
  const totalSlots = SHOPEE_REPORTS.length + TIKTOK_REPORTS.length;

  const allSlots = [...SHOPEE_REPORTS, ...TIKTOK_REPORTS];
  const missingSlots = allSlots.filter((s) => !files.has(slotKey(s)));
  const showError = attempted && missingSlots.length > 0;
  const errorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (showError && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showError, missingSlots.length]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">{t('title')}</h2>
          <p className="mt-1 text-sm text-neutral-500">{t('subtitle')}</p>
        </div>
        <div className="text-xs text-neutral-500">
          {t('fileCount', { uploaded: uploadedCount, total: totalSlots })}
        </div>
      </div>

      {selectedPeriod && (
        <div className="rounded-md bg-info-50/40 border border-info-500/30 px-3 py-2 text-xs text-info-500">
          {t('fileTag')}{' '}
          <span className="font-mono font-semibold">{selectedPeriod.label}</span>{' '}
          <span className="text-neutral-500">({selectedPeriod.rangeLabel})</span>.
        </div>
      )}

      {/* Previously uploaded files — shown only for Active periods (re-ingest scenario). */}
      {existingFiles.length > 0 && (
        <div className="rounded-md border border-info-500/30 bg-info-50/40 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-info-500">
            {t('previouslyUploaded', { count: existingFiles.length })}
          </div>
          <p className="mt-1 text-xs text-neutral-700">
            {t.rich('previouslyUploadedBody', {
              b: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
          <ul className="mt-3 space-y-1.5 divide-y divide-info-500/10">
            {existingFiles.map((f) => {
              const replaced = files.has(slotKey({ channel: f.channel, type: f.fileType }));
              return (
                <li
                  key={f.arfId}
                  className="flex items-center gap-2 pt-1.5 text-xs first:pt-0"
                >
                  <span
                    className={cn(
                      'inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-mono font-semibold text-white shrink-0',
                      f.channel === 'SHOPEE' ? 'bg-shopee' : 'bg-neutral-900',
                    )}
                  >
                    {f.channel === 'SHOPEE' ? 'S' : 'T'}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500 w-32 shrink-0">
                    {f.fileType.replace(/_/g, ' ')}
                  </span>
                  <span
                    className={cn(
                      'flex-1 truncate font-mono text-[11px]',
                      replaced ? 'line-through text-neutral-400' : 'text-neutral-900',
                    )}
                    title={f.filename}
                  >
                    {f.filename}
                  </span>
                  <span className="text-[11px] tabular-nums text-neutral-500 shrink-0">
                    {fmtBytes(f.sizeBytes)}
                  </span>
                  {f.rowCount != null && (
                    <span className="text-[11px] tabular-nums text-neutral-500 shrink-0 w-16 text-right">
                      {t('rowsCount', { count: f.rowCount.toLocaleString('en-US') })}
                    </span>
                  )}
                  {replaced && (
                    <span className="rounded-full bg-warning-500/10 px-2 py-0.5 text-[10px] font-medium text-warning-500 shrink-0">
                      {t('willReplace')}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {showError && (
        <div
          ref={errorRef}
          className="rounded-md border border-error-500 bg-error-50 px-4 py-3"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-error-500" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-error-500">
                {missingSlots.length === 1
                  ? t('errorMissingSingular')
                  : t('errorMissing', { count: missingSlots.length })}
              </div>
              <ul className="mt-2 space-y-1 text-xs text-error-500">
                {missingSlots.map((s) => (
                  <li key={slotKey(s)} className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-mono font-semibold text-white',
                        s.channel === 'SHOPEE' ? 'bg-shopee' : 'bg-neutral-900',
                      )}
                    >
                      {s.channel === 'SHOPEE' ? 'S' : 'T'}
                    </span>
                    {slotLabel(s)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Shopee section */}
      <SectionGroup
        title={t('shopee')}
        badgeClass="bg-shopee text-white"
        badge="S"
        count={SHOPEE_REPORTS.filter((r) => files.has(slotKey(r))).length}
        total={SHOPEE_REPORTS.length}
      >
        <div className="space-y-3">
          <TotalGmvPreviewCard
            file={files.get(slotKey({ channel: 'SHOPEE', type: 'SALES' })) ?? null}
            adsFile={files.get(slotKey({ channel: 'SHOPEE', type: 'ADS' })) ?? null}
            brandAdsFile={files.get(slotKey({ channel: 'SHOPEE', type: 'BRAND_ADS' })) ?? null}
            offPlatformAdsFile={files.get(slotKey({ channel: 'SHOPEE', type: 'OFF_PLATFORM_ADS' })) ?? null}
            trafficFile={files.get(slotKey({ channel: 'SHOPEE', type: 'TRAFFIC' })) ?? null}
            affiliateFile={files.get(slotKey({ channel: 'SHOPEE', type: 'AFFILIATE' })) ?? null}
          />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {SHOPEE_REPORTS.map((slot) => {
              const k = slotKey(slot);
              const f = files.get(k) ?? null;
              return (
                <FileSlot
                  key={k}
                  slot={slot}
                  label={slotLabel(slot)}
                  subtitle={slotSubtitle(slot)}
                  file={f}
                  onChange={(file) => onSetFile(k, file)}
                  highlight={attempted && !f}
                />
              );
            })}
          </div>
        </div>
      </SectionGroup>

      {/* TikTok section */}
      <SectionGroup
        title={t('tiktok')}
        badgeClass="bg-neutral-900 text-white"
        badge="T"
        count={TIKTOK_REPORTS.filter((r) => files.has(slotKey(r))).length}
        total={TIKTOK_REPORTS.length}
      >
        <div className="space-y-3">
          <TikTokMetricsPreviewCard
            file={files.get(slotKey({ channel: 'TIKTOK', type: 'SALES' })) ?? null}
            trafficFile={files.get(slotKey({ channel: 'TIKTOK', type: 'TRAFFIC' })) ?? null}
            affiliateFile={files.get(slotKey({ channel: 'TIKTOK', type: 'AFFILIATE' })) ?? null}
          />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {TIKTOK_REPORTS.map((slot) => {
              const k = slotKey(slot);
              const f = files.get(k) ?? null;
              return (
                <FileSlot
                  key={k}
                  slot={slot}
                  label={slotLabel(slot)}
                  subtitle={slotSubtitle(slot)}
                  file={f}
                  onChange={(file) => onSetFile(k, file)}
                  highlight={attempted && !f}
                />
              );
            })}
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
  count,
  total,
  children,
}: {
  title: string;
  badge: string;
  badgeClass: string;
  count: number;
  total: number;
  children: React.ReactNode;
}) {
  const t = useTranslations('uploadWizard.step2');
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
            badgeClass,
          )}
        >
          <span className="font-mono">{badge}</span>
          {title}
        </span>
        <span className="text-xs text-neutral-500">{t('selected', { count, total })}</span>
      </div>
      {children}
    </div>
  );
}

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB
const ACCEPT = '.csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv';

function FileSlot({
  slot,
  label,
  subtitle,
  file,
  onChange,
  highlight,
}: {
  slot: ReportSlot;
  label: string;
  subtitle: string;
  file: File | null;
  onChange: (f: File | null) => void;
  highlight?: boolean;
}) {
  const t = useTranslations('uploadWizard.step2.fileSlot');
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reference slot so the unused-import lint doesn't flag it
  void slot;

  const validate = (f: File): boolean => {
    if (f.size > MAX_BYTES) {
      setError(t('errorTooBig'));
      return false;
    }
    const ext = f.name.toLowerCase().match(/\.(csv|xlsx)$/);
    if (!ext) {
      setError(t('errorBadExt'));
      return false;
    }
    setError(null);
    return true;
  };

  const onPick = (f: File | null) => {
    if (!f) return;
    if (validate(f)) onChange(f);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const onDragLeave = () => setDragOver(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) onPick(f);
  };

  const remove = () => {
    onChange(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div
      className={cn(
        'rounded-md border bg-white p-3',
        highlight ? 'border-error-500 bg-error-50/30' : 'border-neutral-200',
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-neutral-900">{label}</div>
          <div className="text-xs text-neutral-500">{subtitle}</div>
        </div>
        {highlight && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-error-50 px-2 py-0.5 text-[10px] font-medium text-error-500">
            <AlertCircle className="h-2.5 w-2.5" />
            {t('required')}
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />

      {!file && (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed py-4 text-center transition-colors',
            dragOver
              ? 'border-info-500 bg-info-50/40'
              : 'border-neutral-300 hover:border-neutral-400',
          )}
        >
          <Upload className="h-5 w-5 text-neutral-400" />
          <div className="text-xs text-neutral-600">
            {dragOver ? t('dropHere') : t('dragDrop')}
          </div>
          <div className="text-[10px] text-neutral-400">{t('fileSpec')}</div>
        </div>
      )}

      {file && (
        <div className="flex items-start gap-2 rounded-md border border-success-500/30 bg-success-50/40 px-3 py-2">
          <FileText className="h-4 w-4 mt-0.5 text-success-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-neutral-900 truncate">{file.name}</div>
            <div className="text-xs text-neutral-500">
              {(file.size / 1024 / 1024).toFixed(2)} MB
              <span className="ml-2 inline-flex items-center gap-0.5 text-success-500">
                <CheckCircle className="h-3 w-3" />
                {t('ready')}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-100"
            aria-label={t('replace')}
            title={t('replace')}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={remove}
            className="rounded p-1 text-neutral-500 hover:bg-error-50 hover:text-error-500"
            aria-label={t('remove')}
            title={t('remove')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="mt-2 flex items-start gap-1.5 text-xs text-error-500">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
