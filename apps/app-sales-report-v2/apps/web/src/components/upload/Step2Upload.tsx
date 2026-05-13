'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, X, RefreshCw, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@v2/ui';
import type { SelectedPeriod } from './Step1Period';

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
  label: string;
  subtitle: string;
}

const SHOPEE_REPORTS: ReportSlot[] = [
  { channel: 'SHOPEE', type: 'SALES', label: 'Sales report', subtitle: 'Order-level transactions' },
  { channel: 'SHOPEE', type: 'ADS', label: 'Ads report', subtitle: 'Sponsored product spend' },
  { channel: 'SHOPEE', type: 'BRAND_ADS', label: 'Brand Ads report', subtitle: 'Awareness-objective spend' },
  {
    channel: 'SHOPEE',
    type: 'OFF_PLATFORM_ADS',
    label: 'Off Platform Ads report',
    subtitle: 'Off-site ads spend',
  },
  { channel: 'SHOPEE', type: 'TRAFFIC', label: 'Traffic report', subtitle: 'Sessions, PV, conversion' },
  { channel: 'SHOPEE', type: 'AFFILIATE', label: 'Affiliate report', subtitle: 'Commission payments' },
];

const TIKTOK_REPORTS: ReportSlot[] = [
  { channel: 'TIKTOK', type: 'SALES', label: 'Sales report', subtitle: 'Order-level transactions' },
  { channel: 'TIKTOK', type: 'TRAFFIC', label: 'Traffic report', subtitle: 'Sessions, PV, conversion' },
  { channel: 'TIKTOK', type: 'AFFILIATE', label: 'Affiliate report', subtitle: 'Commission payments' },
];

export function slotKey(slot: { channel: Channel; type: ReportType }): string {
  return `${slot.channel}::${slot.type}`;
}

interface Props {
  selectedPeriod: SelectedPeriod | null;
  files: Map<string, File>;
  onFilesChange: (next: Map<string, File>) => void;
  attempted?: boolean;
}

export function Step2Upload({ selectedPeriod, files, onFilesChange, attempted = false }: Props) {
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
          <h2 className="text-base font-semibold text-neutral-900">Step 2 · Upload files</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Drop the raw export for each report type. Skip any you don&apos;t have — partial uploads are allowed.
          </p>
        </div>
        <div className="text-xs text-neutral-500">
          <span className="font-semibold text-neutral-900">{uploadedCount}</span> / {totalSlots} files
        </div>
      </div>

      {selectedPeriod && (
        <div className="rounded-md bg-info-50/40 border border-info-500/30 px-3 py-2 text-xs text-info-500">
          Files will be tagged with{' '}
          <span className="font-mono font-semibold">{selectedPeriod.label}</span>{' '}
          <span className="text-neutral-500">({selectedPeriod.rangeLabel})</span>.
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
                {missingSlots.length} report{missingSlots.length > 1 ? 's' : ''} missing — upload required to continue
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
                    {s.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Shopee section */}
      <SectionGroup
        title="Shopee"
        badgeClass="bg-shopee text-white"
        badge="S"
        count={SHOPEE_REPORTS.filter((r) => files.has(slotKey(r))).length}
        total={SHOPEE_REPORTS.length}
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {SHOPEE_REPORTS.map((slot) => {
            const k = slotKey(slot);
            const f = files.get(k) ?? null;
            return (
              <FileSlot
                key={k}
                slot={slot}
                file={f}
                onChange={(file) => onSetFile(k, file)}
                highlight={attempted && !f}
              />
            );
          })}
        </div>
      </SectionGroup>

      {/* TikTok section */}
      <SectionGroup
        title="TikTok Shop"
        badgeClass="bg-neutral-900 text-white"
        badge="T"
        count={TIKTOK_REPORTS.filter((r) => files.has(slotKey(r))).length}
        total={TIKTOK_REPORTS.length}
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {TIKTOK_REPORTS.map((slot) => {
            const k = slotKey(slot);
            const f = files.get(k) ?? null;
            return (
              <FileSlot
                key={k}
                slot={slot}
                file={f}
                onChange={(file) => onSetFile(k, file)}
                highlight={attempted && !f}
              />
            );
          })}
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
        <span className="text-xs text-neutral-500">
          {count}/{total} selected
        </span>
      </div>
      {children}
    </div>
  );
}

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB
const ACCEPT = '.csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv';

function FileSlot({
  slot,
  file,
  onChange,
  highlight,
}: {
  slot: ReportSlot;
  file: File | null;
  onChange: (f: File | null) => void;
  highlight?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const validate = (f: File): boolean => {
    if (f.size > MAX_BYTES) {
      setError('File exceeds 100 MB limit');
      return false;
    }
    const ext = f.name.toLowerCase().match(/\.(csv|xlsx)$/);
    if (!ext) {
      setError('Only .csv and .xlsx are accepted');
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
          <div className="text-sm font-medium text-neutral-900">{slot.label}</div>
          <div className="text-xs text-neutral-500">{slot.subtitle}</div>
        </div>
        {highlight && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-error-50 px-2 py-0.5 text-[10px] font-medium text-error-500">
            <AlertCircle className="h-2.5 w-2.5" />
            required
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
            {dragOver ? 'Drop here' : 'Drag & drop or click to browse'}
          </div>
          <div className="text-[10px] text-neutral-400">.csv or .xlsx — up to 100 MB</div>
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
                Ready
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-100"
            aria-label="Replace"
            title="Replace"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={remove}
            className="rounded p-1 text-neutral-500 hover:bg-error-50 hover:text-error-500"
            aria-label="Remove"
            title="Remove"
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
