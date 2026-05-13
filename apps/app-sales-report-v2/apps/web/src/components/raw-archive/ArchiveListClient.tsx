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
} from 'lucide-react';
import { cn } from '@v2/ui';
import type { ArchivePeriod, ArchiveFile, PeriodStatus } from '@/lib/raw-archive-mock';
import { useEffectivePeriods } from '@/lib/raw-archive-state';

interface Props {
  periods: ArchivePeriod[];
}

type PeriodFilter = 'all' | string;
type ChannelFilter = 'all' | 'Shopee' | 'TikTok Shop';

export function ArchiveListClient({ periods: basePeriods }: Props) {
  const periods = useEffectivePeriods(basePeriods);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [query, setQuery] = useState('');

  const visiblePeriods = useMemo(() => {
    let list = periods;
    if (periodFilter !== 'all') {
      list = list.filter((p) => p.periodKey === periodFilter);
    }
    const q = query.trim().toLowerCase();
    return list
      .map((p) => ({
        ...p,
        files: p.files.filter((f) => {
          if (channelFilter !== 'all' && f.platform !== channelFilter) return false;
          if (q && !f.filename.toLowerCase().includes(q)) return false;
          return true;
        }),
      }))
      .filter((p) => p.files.length > 0);
  }, [periods, periodFilter, channelFilter, query]);

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

  // Period pills — show weekly periods only, sorted desc by ingestedAt
  const periodPills = useMemo(
    () =>
      [...periods]
        .filter((p) => p.granularity === 'week')
        .sort((a, b) => b.ingestedAt.localeCompare(a.ingestedAt))
        .slice(0, 6),
    [periods],
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Raw archive</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Every uploaded report, archived immutably for audit. Originals are preserved exactly
            as ingested — no edits possible.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <Download className="h-3.5 w-3.5" />
          Bulk download
        </button>
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
          value="7 years"
          sub="Per Vietnam tax regulation"
        />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500">
            Period
          </span>
          <TabPills<PeriodFilter>
            value={periodFilter}
            onChange={setPeriodFilter}
            options={[
              { id: 'all', label: 'All' },
              ...periodPills.map((p) => ({ id: p.periodKey, label: p.label })),
            ]}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500">
            Channel
          </span>
          <TabPills<ChannelFilter>
            value={channelFilter}
            onChange={setChannelFilter}
            options={[
              { id: 'all', label: 'All' },
              { id: 'Shopee', label: 'Shopee' },
              { id: 'TikTok Shop', label: 'TikTok' },
            ]}
          />
        </div>
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
          {visiblePeriods.map((p) => (
            <PeriodSection key={p.periodKey} period={p} />
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

function PeriodSection({ period }: { period: ArchivePeriod }) {
  const totalRows = period.files.reduce((s, f) => s + f.rows, 0);
  return (
    <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
      {/* Section header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-neutral-100">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-semibold font-mono text-neutral-900">{period.label}</span>
          <span className="text-xs text-neutral-500">· {period.rangeLabel}</span>
          <PeriodStatusPill status={period.status} />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-neutral-500 tabular-nums">
            <span className="font-semibold text-neutral-900">{period.files.length}</span> files
            {' · '}
            <span className="font-semibold text-neutral-900">{totalRows.toLocaleString('en-US')}</span>{' '}
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
    </div>
  );
}

function FileRow({ file }: { file: ArchiveFile }) {
  const hasHistory = !!file.replacedVersions && file.replacedVersions.length > 0;
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
          <IconButton title="Download" icon={<Download className="h-3.5 w-3.5" />} />
          <IconButton title="Preview" icon={<Eye className="h-3.5 w-3.5" />} />
          <IconButton
            title={hasHistory ? `${file.replacedVersions!.length} prior version(s)` : 'No history'}
            icon={<History className="h-3.5 w-3.5" />}
            tone={hasHistory ? 'warning' : 'neutral'}
          />
        </div>
      </td>
    </tr>
  );
}

function IconButton({
  title,
  icon,
  tone = 'neutral',
}: {
  title: string;
  icon: React.ReactNode;
  tone?: 'neutral' | 'warning';
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
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

function TabPills<T extends string>({
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
            'rounded px-2.5 py-1 text-xs font-medium transition-colors',
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
