'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  ArrowRight,
  Download,
  History,
  Lock,
  FileText,
  Calculator,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@v2/ui';
import { DEFAULT_VND_PER_KRW, fmtDateTime, fmtVND } from '@/lib/format';
import { useFxRateOverride } from '@/lib/fx-rate-override';
import type { ArchivePeriod, ArchiveFile, PeriodStatus } from '@/lib/raw-archive-mock';
import { useEffectivePeriods, type EffectivePeriod } from '@/lib/raw-archive-state';
import { downloadArchiveFile } from '@/lib/raw-archive-download';
import { FileHistoryModal } from './FileHistoryModal';
import { useInlineApproval } from './InlineApprovalActions';

interface Props {
  periods: ArchivePeriod[];
}

type GranularityFilter = 'week' | 'month';
type PeriodKeyFilter = 'all' | string;

export function ArchiveListClient({ periods: basePeriods }: Props) {
  const t = useTranslations('rawArchive');
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
        <h1 className="text-xl font-semibold text-neutral-900">{t('pageTitle')}</h1>
        <p className="mt-1 text-sm text-neutral-500">{t('pageSubtitle')}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard
          label={t('stat.files')}
          value={stats.fileCount.toLocaleString('en-US')}
          sub={
            stats.periodCount === 1
              ? t('stat.filesSubSingular', { count: stats.periodCount })
              : t('stat.filesSub', { count: stats.periodCount })
          }
        />
        <StatCard
          label={t('stat.rows')}
          value={stats.rowCount.toLocaleString('en-US')}
          sub={t('stat.rowsSub', { size: fmtBytes(stats.byteCount) })}
        />
        <StatCard
          label={t('stat.activePeriod')}
          value={stats.activePeriod ? stats.activePeriod.label : '—'}
          sub={
            stats.activePeriod
              ? t('stat.activePeriodSub', { count: stats.activePeriod.files.length })
              : t('stat.activePeriodEmpty')
          }
        />
        <StatCard
          label={t('stat.retention')}
          value={t('stat.retentionValue')}
          sub={t('stat.retentionSub')}
        />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2">
        <WideToggle<GranularityFilter>
          value={granularity}
          onChange={handleGranularityChange}
          options={[
            { id: 'week', label: t('filter.weekly') },
            { id: 'month', label: t('filter.monthly') },
          ]}
        />

        {periodPills.length > 0 && (
          <>
            <span className="h-6 w-px bg-neutral-200" aria-hidden />
            <div className="flex flex-wrap items-center gap-1">
              <PeriodFilterPill
                label={t('filter.all')}
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
            placeholder={t('filter.searchPlaceholder')}
            className="w-full rounded-md border border-neutral-300 bg-white py-1.5 pl-8 pr-2 text-xs placeholder:text-neutral-400 focus:outline-none focus:border-info-500"
          />
        </div>
      </div>

      {/* Period sections */}
      {visiblePeriods.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-10 text-center text-sm text-neutral-500">
          {t('empty')}
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
  period: EffectivePeriod;
  defaultOpen: boolean;
}) {
  const t = useTranslations('rawArchive');
  const [open, setOpen] = useState(defaultOpen);
  const totalRows = period.files.reduce((s, f) => s + f.rows, 0);
  const approval = useInlineApproval(period);
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
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-neutral-500 tabular-nums">
            <span className="font-semibold text-neutral-900">{period.files.length}</span>{' '}
            {t('fileColumn.file').toLowerCase()}
            {' · '}
            <span className="font-semibold text-neutral-900">
              {totalRows.toLocaleString('en-US')}
            </span>{' '}
            {t('fileColumn.rows').toLowerCase()}
          </span>
          {approval.buttons}
          <Link
            href={`/raw-archive/${encodeURIComponent(period.periodKey)}`}
            className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          >
            {t('section.openDetail')}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {approval.form}

      {open && (
        <>
          {/* Files table */}
          <table className="w-full text-sm">
            <thead className="bg-neutral-50/40 text-[10px] uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">{t('fileColumn.file')}</th>
                <th className="px-3 py-2 text-left font-semibold w-32">{t('fileColumn.channel')}</th>
                <th className="px-3 py-2 text-left font-semibold w-24">{t('fileColumn.type')}</th>
                <th className="px-3 py-2 text-right font-semibold w-20">{t('fileColumn.rows')}</th>
                <th className="px-3 py-2 text-right font-semibold w-20">{t('fileColumn.size')}</th>
                <th className="px-3 py-2 text-left font-semibold w-36">{t('fileColumn.uploaded')}</th>
                <th className="px-3 py-2 text-left font-semibold w-28">{t('fileColumn.by')}</th>
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

const MANUAL_FIELD_KEYS = [
  'affiliateBookingFees',
  'shopeeLivestreamFees',
  'tiktokLivestreamFees',
  'tiktokAdsSpending',
] as const;
type ManualFieldKey = (typeof MANUAL_FIELD_KEYS)[number];
function isKnownManualField(key: string): key is ManualFieldKey {
  return (MANUAL_FIELD_KEYS as readonly string[]).includes(key);
}

function ManualInputSection({ period }: { period: ArchivePeriod }) {
  const t = useTranslations('rawArchive.manualSection');
  const tManualField = useTranslations('uploadWizard.step3.field');
  const manualFieldLabel = (key: string): string =>
    isKnownManualField(key) ? tManualField(key) : key;
  const [open, setOpen] = useState(false);
  const entries = Object.entries(period.manualInputs);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const canEdit = period.status === 'Draft';
  const { rate: krwRate } = useFxRateOverride(DEFAULT_VND_PER_KRW);
  const krwOf = (vnd: number): string =>
    `≈ ${new Intl.NumberFormat('ko-KR').format(Math.round(vnd / krwRate))} ₩`;

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
          <span className="text-xs font-semibold text-neutral-900">{t('title')}</span>
          <span className="text-[11px] text-neutral-500">
            {t('fieldCount', { count: entries.length })}
            <span className="font-mono font-semibold text-neutral-700 tabular-nums">
              {fmtVND(total)}
            </span>
            <span className="ml-2 font-mono text-[10px] text-neutral-400 tabular-nums">
              {krwOf(total)}
            </span>
          </span>
          {canEdit ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-500/10 px-2 py-0.5 text-[10px] font-medium text-success-500">
              {t('editable')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
              <Lock className="h-2.5 w-2.5" />
              {t('locked')}
            </span>
          )}
        </div>
        <span className="text-[11px] text-neutral-400">
          {open ? t('hide') : t('show')}
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
                <span className="text-neutral-600 truncate">{manualFieldLabel(field)}</span>
                <span className="text-right font-mono tabular-nums whitespace-nowrap">
                  <span className="font-semibold text-neutral-900">{fmtVND(value)}</span>
                  <span className="ml-2 text-[10px] text-neutral-500">{krwOf(value)}</span>
                </span>
              </div>
            ))}
          </div>
          {canEdit && (
            <div className="mt-2 text-[11px] text-neutral-500">
              {t.rich('editHint', {
                link: (chunks) => (
                  <Link
                    href={`/raw-archive/${encodeURIComponent(period.periodKey)}`}
                    className="font-medium text-info-500 hover:underline"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FileRow({ file }: { file: ArchiveFile }) {
  const t = useTranslations('rawArchive.iconBtn');
  const hasHistory = !!file.replacedVersions && file.replacedVersions.length > 0;
  const [historyOpen, setHistoryOpen] = useState(false);
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
          {fmtDateTime(file.uploadedAt)}
        </span>
      </td>
      <td className="px-3 py-2.5 align-middle">
        <span className="text-xs text-neutral-700 truncate">{file.uploadedBy}</span>
      </td>
      <td className="px-3 py-2.5 align-middle text-right">
        <div className="inline-flex items-center gap-1">
          <IconButton
            title={t('download')}
            icon={<Download className="h-3.5 w-3.5" />}
            onClick={() => downloadArchiveFile(file)}
          />
          <IconButton
            title={
              hasHistory
                ? t('priorVersions', { count: file.replacedVersions!.length })
                : t('noPriorVersions')
            }
            icon={<History className="h-3.5 w-3.5" />}
            tone={hasHistory ? 'warning' : 'neutral'}
            onClick={() => setHistoryOpen(true)}
          />
        </div>
      </td>
      {historyOpen && <FileHistoryModal file={file} onClose={() => setHistoryOpen(false)} />}
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
  const t = useTranslations('rawArchive.status');
  if (status === 'Draft') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success-500">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-success-500" />
        {t('active')}
      </span>
    );
  }
  if (status === 'Locked') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500">
        <Lock className="h-2.5 w-2.5" />
        {t('locked')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-info-500">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-info-500" />
      {t('finalized')}
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

