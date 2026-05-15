'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  ArrowRight,
  Download,
  Eye,
  History,
  Lock,
  FileText,
  Calculator,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
} from 'lucide-react';
import { cn } from '@v2/ui';
import { fmtVND } from '@/lib/format';
import type { ArchivePeriod, ArchiveFile, PeriodStatus } from '@/lib/raw-archive-mock';
import { useEffectivePeriods } from '@/lib/raw-archive-state';
import { downloadArchiveFile } from '@/lib/raw-archive-download';
import { FilePreviewModal } from './FilePreviewModal';
import { FileHistoryModal } from './FileHistoryModal';

interface Props {
  periods: ArchivePeriod[];
}

type GranularityFilter = 'week' | 'month';
type PeriodKeyFilter = 'all' | string;

export function ArchiveListClient({ periods: basePeriods }: Props) {
  const periods = useEffectivePeriods(basePeriods);
  const [granularity, setGranularity] = useState<GranularityFilter>('week');
  const [periodKeyFilter, setPeriodKeyFilter] = useState<PeriodKeyFilter>('all');
  const [query, setQuery] = useState('');

  // Reset period filter whenever granularity changes
  const handleGranularityChange = (g: GranularityFilter) => {
    setGranularity(g);
    setPeriodKeyFilter('all');
  };

  // Period pills for the active granularity (sorted newest first)
  const periodPills = useMemo(
    () =>
      [...periods]
        .filter((p) => p.granularity === granularity)
        .sort((a, b) => b.ingestedAt.localeCompare(a.ingestedAt)),
    [periods, granularity],
  );

  const visiblePeriods = useMemo(() => {
    let list = periods.filter((p) => p.granularity === granularity);
    if (periodKeyFilter !== 'all') {
      list = list.filter((p) => p.periodKey === periodKeyFilter);
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list
      .map((p) => ({
        ...p,
        files: p.files.filter((f) => f.filename.toLowerCase().includes(q)),
      }))
      .filter((p) => p.files.length > 0);
  }, [periods, granularity, periodKeyFilter, query]);

  // Stats across visible periods
  const stats = useMemo(() => {
    const fileCount = visiblePeriods.reduce((s, p) => s + p.files.length, 0);
    const rowCount = visiblePeriods.reduce(
      (s, p) => s + p.files.reduce((a, f) => a + f.rows, 0),
      0,
    );
    const byteCount = visiblePeriods.reduce(
      (s, p) => s + p.files.reduce((a, f) => a + f.bytes, 0),
      0,
    );
    const activePeriod = visiblePeriods.find((p) => p.status === 'Draft') ?? visiblePeriods[0];
    return {
      fileCount,
      rowCount,
      byteCount,
      periodCount: visiblePeriods.length,
      activePeriod,
    };
  }, [visiblePeriods]);


  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Raw archive</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Every uploaded report, archived immutably for audit. Originals are preserved exactly as
          ingested — no edits possible.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard
          label="Files in archive"
          value={stats.fileCount.toLocaleString('en-US')}
          sub={`Across ${stats.periodCount} period${stats.periodCount !== 1 ? 's' : ''}`}
        />
        <StatCard
          label="Total rows ingested"
          value={stats.rowCount.toLocaleString('en-US')}
          sub={`Compressed footprint ${fmtBytes(stats.byteCount)}`}
        />
        <StatCard
          label="Active period"
          value={stats.activePeriod ? stats.activePeriod.label : '—'}
          sub={
            stats.activePeriod
              ? `${stats.activePeriod.files.length} files · re-ingestable`
              : 'No active period'
          }
        />
        <StatCard
          label="Retention"
          value="5 years"
          sub="Per Vietnam tax regulation"
        />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2">
        <WideToggle<GranularityFilter>
          value={granularity}
          onChange={handleGranularityChange}
          options={[
            { id: 'week', label: 'Weekly' },
            { id: 'month', label: 'Monthly' },
          ]}
        />

        {periodPills.length > 0 && (
          <>
            <span className="h-6 w-px bg-neutral-200" aria-hidden />
            <div className="flex flex-wrap items-center gap-1">
              <PeriodFilterPill
                label="All"
                active={periodKeyFilter === 'all'}
                onClick={() => setPeriodKeyFilter('all')}
              />
              {periodPills.map((p) => (
                <PeriodFilterPill
                  key={p.periodKey}
                  label={p.label}
                  active={periodKeyFilter === p.periodKey}
                  onClick={() => setPeriodKeyFilter(p.periodKey)}
                />
              ))}
            </div>
          </>
        )}

        <div className="relative ml-auto w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filename…"
            className="w-full rounded-md border border-neutral-300 bg-white py-1.5 pl-8 pr-2 text-xs placeholder:text-neutral-400 focus:outline-none focus:border-info-500"
          />
        </div>
      </div>

      {/* Period sections */}
      {visiblePeriods.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-10 text-center text-sm text-neutral-500">
          No files match the current filters.
        </div>
      ) : (
        <div className="space-y-3">
          {visiblePeriods.map((p, i) => (
            <PeriodSection key={p.periodKey} period={p} defaultOpen={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Pieces
// ----------------------------------------------------------------------------

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className="mt-0.5 text-2xl font-bold tabular-nums text-neutral-900">{value}</div>
      <div className="mt-1.5 text-[11px] text-neutral-500">{sub}</div>
    </div>
  );
}

function PeriodSection({
  period,
  defaultOpen,
}: {
  period: ArchivePeriod;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const totalRows = period.files.reduce((s, f) => s + f.rows, 0);
  return (
    <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
      {/* Section header — clickable to toggle (Open detail stays a separate Link) */}
      <div
        className={cn(
          'flex items-center justify-between gap-3 px-4 py-3',
          open && 'border-b border-neutral-100',
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-3 min-w-0 flex-1 text-left -my-1 -mx-2 px-2 py-1 rounded hover:bg-neutral-50"
        >
          {open ? (
            <ChevronDown className="h-4 w-4 text-neutral-400 shrink-0" />
          ) : (
            <ChevronRightIcon className="h-4 w-4 text-neutral-400 shrink-0" />
          )}
          <span className="text-sm font-semibold font-mono text-neutral-900">
            {period.label}
          </span>
          <span className="text-xs text-neutral-500">· {period.rangeLabel}</span>
          <PeriodStatusPill status={period.status} />
        </button>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-neutral-500 tabular-nums">
            <span className="font-semibold text-neutral-900">{period.files.length}</span> files
            {' · '}
            <span className="font-semibold text-neutral-900">
              {totalRows.toLocaleString('en-US')}
            </span>{' '}
            rows
          </span>
          <Link
            href={`/raw-archive/${encodeURIComponent(period.periodKey)}`}
            className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Open detail
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {open && (
        <>
          {/* Files table */}
          <table className="w-full text-sm">
            <thead className="bg-neutral-50/40 text-[10px] uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">File</th>
                <th className="px-3 py-2 text-left font-semibold w-32">Channel</th>
                <th className="px-3 py-2 text-left font-semibold w-24">Type</th>
                <th className="px-3 py-2 text-right font-semibold w-20">Rows</th>
                <th className="px-3 py-2 text-right font-semibold w-20">Size</th>
                <th className="px-3 py-2 text-left font-semibold w-36">Uploaded</th>
                <th className="px-3 py-2 text-left font-semibold w-28">By</th>
                <th className="px-3 py-2 text-right font-semibold w-28"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {period.files.map((f) => (
                <FileRow key={f.id} file={f} />
              ))}
            </tbody>
          </table>

          {/* Manual Input section */}
          <ManualInputSection period={period} />
        </>
      )}
    </div>
  );
}

function ManualInputSection({ period }: { period: ArchivePeriod }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(period.manualInputs);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const canEdit = period.status === 'Draft';

  return (
    <div className="border-t border-neutral-100 bg-neutral-50/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-2 hover:bg-neutral-50/60"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
          ) : (
            <ChevronRightIcon className="h-3.5 w-3.5 text-neutral-400" />
          )}
          <Calculator className="h-3.5 w-3.5 text-neutral-500" />
          <span className="text-xs font-semibold text-neutral-900">Manual Input</span>
          <span className="text-[11px] text-neutral-500">
            · {entries.length} fields · total{' '}
            <span className="font-mono font-semibold text-neutral-700 tabular-nums">
              {fmtVND(total)}
            </span>
          </span>
          {canEdit ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-500/10 px-2 py-0.5 text-[10px] font-medium text-success-500">
              Editable
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
              <Lock className="h-2.5 w-2.5" />
              Locked
            </span>
          )}
        </div>
        <span className="text-[11px] text-neutral-400">
          {open ? 'Hide' : 'Show'} values
        </span>
      </button>

      {open && (
        <div className="px-4 pb-3 pt-1">
          <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs">
            {entries.map(([field, value]) => (
              <div
                key={field}
                className="flex items-baseline justify-between gap-3 py-1 border-b border-neutral-50 last:border-0"
              >
                <span className="text-neutral-600 truncate">{field}</span>
                <span className="font-mono font-semibold text-neutral-900 tabular-nums whitespace-nowrap">
                  {fmtVND(value)}
                </span>
              </div>
            ))}
          </div>
          {canEdit && (
            <div className="mt-2 text-[11px] text-neutral-500">
              Click{' '}
              <Link
                href={`/raw-archive/${encodeURIComponent(period.periodKey)}`}
                className="font-medium text-info-500 hover:underline"
              >
                Open detail
              </Link>{' '}
              to edit these values.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FileRow({ file }: { file: ArchiveFile }) {
  const hasHistory = !!file.replacedVersions && file.replacedVersions.length > 0;
  const [modal, setModal] = useState<'preview' | 'history' | null>(null);
  return (
    <tr className="hover:bg-neutral-50/60">
      <td className="px-4 py-2.5 align-middle">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
          <span className="font-mono text-xs text-neutral-900 truncate">{file.filename}</span>
        </div>
      </td>
      <td className="px-3 py-2.5 align-middle">
        <PlatformBadge platform={file.platform} />
      </td>
      <td className="px-3 py-2.5 align-middle">
        <TypePill type={file.source} />
      </td>
      <td className="px-3 py-2.5 align-middle text-right">
        <span className="font-mono text-xs text-neutral-900 tabular-nums">
          {file.rows.toLocaleString('en-US')}
        </span>
      </td>
      <td className="px-3 py-2.5 align-middle text-right">
        <span className="font-mono text-xs text-neutral-500 tabular-nums">
          {fmtBytes(file.bytes)}
        </span>
      </td>
      <td className="px-3 py-2.5 align-middle">
        <span className="font-mono text-xs text-neutral-500 tabular-nums whitespace-nowrap">
          {fmtUploadedAt(file.uploadedAt)}
        </span>
      </td>
      <td className="px-3 py-2.5 align-middle">
        <span className="text-xs text-neutral-700 truncate">{file.uploadedBy}</span>
      </td>
      <td className="px-3 py-2.5 align-middle text-right">
        <div className="inline-flex items-center gap-1">
          <IconButton
            title="Download original file"
            icon={<Download className="h-3.5 w-3.5" />}
            onClick={() => downloadArchiveFile(file)}
          />
          <IconButton
            title="Preview first 5 rows"
            icon={<Eye className="h-3.5 w-3.5" />}
            onClick={() => setModal('preview')}
          />
          <IconButton
            title={hasHistory ? `${file.replacedVersions!.length} prior version(s)` : 'No prior versions'}
            icon={<History className="h-3.5 w-3.5" />}
            tone={hasHistory ? 'warning' : 'neutral'}
            onClick={() => setModal('history')}
          />
        </div>
      </td>
      {modal === 'preview' && <FilePreviewModal file={file} onClose={() => setModal(null)} />}
      {modal === 'history' && <FileHistoryModal file={file} onClose={() => setModal(null)} />}
    </tr>
  );
}

function IconButton({
  title,
  icon,
  tone = 'neutral',
  onClick,
}: {
  title: string;
  icon: React.ReactNode;
  tone?: 'neutral' | 'warning';
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        'inline-flex h-6 w-6 items-center justify-center rounded transition-colors',
        tone === 'warning'
          ? 'text-warning-500 hover:bg-warning-500/10'
          : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100',
      )}
    >
      {icon}
    </button>
  );
}


function PlatformBadge({ platform }: { platform: 'Shopee' | 'TikTok Shop' }) {
  const isShopee = platform === 'Shopee';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap',
        isShopee ? 'bg-shopee text-white' : 'bg-neutral-900 text-white',
      )}
    >
      <span className="font-mono">{isShopee ? 'S' : 'T'}</span>
      {platform}
    </span>
  );
}

function TypePill({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-medium text-neutral-700 whitespace-nowrap">
      {type}
    </span>
  );
}

function PeriodStatusPill({ status }: { status: PeriodStatus }) {
  if (status === 'Draft') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success-500">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-success-500" />
        Active
      </span>
    );
  }
  if (status === 'Locked') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500">
        <Lock className="h-2.5 w-2.5" />
        Locked
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-info-500">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-info-500" />
      Finalized
    </span>
  );
}

function PeriodFilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium font-mono transition-colors',
        active
          ? 'border-neutral-900 bg-neutral-900 text-white'
          : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50',
      )}
    >
      {label}
    </button>
  );
}

function WideToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-md border border-neutral-300 bg-white p-0.5">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            'min-w-[140px] rounded px-4 py-1.5 text-sm font-medium transition-colors',
            value === opt.id
              ? 'bg-neutral-900 text-white'
              : 'text-neutral-700 hover:bg-neutral-100',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function fmtBytes(b: number): string {
  if (b >= 1_000_000) return `${(b / 1_000_000).toFixed(1)} MB`;
  if (b >= 1_000) return `${(b / 1_000).toFixed(1)} KB`;
  return `${b} B`;
}

function fmtUploadedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
