'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Download,
  History,
  Lock,
  Unlock,
  FileCode,
  Activity,
  Calculator,
  GitBranch,
  Files,
  ArrowRight,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@v2/ui';
import { Pencil, Lock as LockIcon } from 'lucide-react';
import { DEFAULT_VND_PER_KRW, fmtDateTime, fmtVND } from '@/lib/format';
import { useFxRateOverride } from '@/lib/fx-rate-override';
import type { ArchivePeriod, ArchiveFile, PeriodStatus } from '@/lib/raw-archive-mock';
import { useEffectivePeriod } from '@/lib/raw-archive-state';
import { downloadArchiveFile, downloadPeriodBulk } from '@/lib/raw-archive-download';
import { ApprovalCard } from './ApprovalCard';
import { ManualInputEditModal } from './ManualInputEditModal';

interface Props {
  period: ArchivePeriod;
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

export function ArchiveDetailClient({ period: basePeriod }: Props) {
  const t = useTranslations('rawArchive.detail');
  const tManual = useTranslations('rawArchive.manualSection');
  const tManualField = useTranslations('uploadWizard.step3.field');
  const manualFieldLabel = (key: string): string =>
    isKnownManualField(key) ? tManualField(key) : key;
  const { rate: krwRate } = useFxRateOverride(DEFAULT_VND_PER_KRW);
  const krwOf = (vnd: number): string =>
    `≈ ${new Intl.NumberFormat('ko-KR').format(Math.round(vnd / krwRate))} ₩`;
  const period = useEffectivePeriod(basePeriod);
  const [manualEditOpen, setManualEditOpen] = useState(false);
  const canEditManual = period.status === 'Draft';
  const [openFile, setOpenFile] = useState<string | null>(null);

  const granLabel =
    period.granularity === 'week' ? t('weeklySnapshot') : t('monthlySnapshot');

  return (
    <div className="space-y-4">
      {/* Breadcrumb + title */}
      <div>
        <Link
          href="/raw-archive"
          className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {t('back')}
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900 font-mono">
              {t('periodTitle', { label: period.label })}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {period.rangeLabel}
              {t('snapshotSuffix', { gran: granLabel })}
            </p>
          </div>
          <StatusBadge status={period.status} />
        </div>
      </div>

      {/* 2-col layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Main column */}
        <div className="space-y-4 min-w-0">
          {/* Manager approval card — only renders for Draft / Finalized */}
          <ApprovalCard period={period} />

          {/* Stat tiles */}
          <div className="grid grid-cols-4 gap-3">
            <StatTile
              label={t('tile.files')}
              value={String(period.fileCount)}
              sub={t('tile.filesSub', { shopee: period.shopeeCount, tiktok: period.tiktokCount })}
            />
            <StatTile
              label={t('tile.rows')}
              value={period.totalRows.toLocaleString('en-US')}
              sub={t('tile.rowsSub')}
            />
            <StatTile
              label={t('tile.reuploads')}
              value={String(period.reuploadCount)}
              sub={
                period.reuploadCount === 0
                  ? t('tile.reuploadsNone')
                  : t('tile.reuploadsSome')
              }
              tone={period.reuploadCount > 0 ? 'warning' : 'neutral'}
            />
            <StatTile
              label={t('tile.formulaConfig')}
              value={period.formulaVersion}
              sub={t('tile.formulaConfigSub')}
              tone="info"
            />
          </div>

          {/* Files archived */}
          <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Files className="h-4 w-4 text-neutral-500" />
                <h3 className="text-sm font-semibold text-neutral-900">{t('filesArchived')}</h3>
                <span className="text-[11px] text-neutral-500">
                  {t('filesStoredAt')}{' '}
                  <code className="font-mono text-neutral-700">
                    /raw/{new Date(period.ingestedAt).getUTCFullYear()}/{period.periodKey}/
                  </code>
                </span>
              </div>
              <button
                type="button"
                onClick={() => downloadPeriodBulk(period)}
                title={t('bulkDownloadTooltip')}
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                <Download className="h-3 w-3" />
                {t('bulkDownload', { count: period.files.length })}
              </button>
            </div>
            <ul className="divide-y divide-neutral-100">
              {period.files.map((f) => (
                <FileRow
                  key={f.id}
                  file={f}
                  expanded={openFile === f.id}
                  onToggle={() => setOpenFile((cur) => (cur === f.id ? null : f.id))}
                />
              ))}
            </ul>
          </div>

          {/* Manual Input */}
          <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-neutral-500" />
                <h3 className="text-sm font-semibold text-neutral-900">{tManual('title')}</h3>
                {canEditManual ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-500/10 px-2 py-0.5 text-[10px] font-medium text-success-500">
                    {tManual('editable')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
                    <LockIcon className="h-2.5 w-2.5" />
                    {tManual('locked')}
                  </span>
                )}
              </div>
              {canEditManual ? (
                <button
                  type="button"
                  onClick={() => setManualEditOpen(true)}
                  className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  <Pencil className="h-3 w-3" />
                  {t('manualEdit')}
                </button>
              ) : (
                <span className="text-[11px] text-neutral-500">
                  {period.status === 'Finalized'
                    ? t('manualHint.unfinalize')
                    : period.status === 'Locked'
                      ? t('manualHint.adminOverride')
                      : ''}
                </span>
              )}
            </div>
            <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
              {Object.entries(period.manualInputs).map(([field, value]) => (
                <div
                  key={field}
                  className="flex items-baseline justify-between gap-3 py-1 border-b border-neutral-50 last:border-0"
                >
                  <span className="text-neutral-600 truncate">{manualFieldLabel(field)}</span>
                  <span className="text-right font-mono tabular-nums whitespace-nowrap">
                    <span className="font-semibold text-neutral-900">{fmtVND(value)}</span>
                    <span className="ml-2 text-[11px] text-neutral-500">{krwOf(value)}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Formula Config snapshot */}
          <Section
            icon={<FileCode className="h-4 w-4 text-neutral-500" />}
            title={t('formulaSnapshot')}
            sub={t('formulaSnapshotSub', {
              version: period.formulaVersion,
              at: fmtDateTime(period.formulaSnapshotAt),
            })}
          >
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-xs text-neutral-600 leading-relaxed">
                {t('formulaSnapshotBody')}
              </p>
              <Link
                href="/settings/formula-config"
                className="shrink-0 inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                {t('viewFormulaSnapshot')}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </Section>

          {/* Activity log */}
          <Section
            icon={<Activity className="h-4 w-4 text-neutral-500" />}
            title={t('activityLog')}
            sub={t('activityEntries', { count: period.activityLog.length })}
          >
            <ul className="px-4 py-3 space-y-2">
              {period.activityLog.map((entry, i) => (
                <li key={i} className="flex items-start gap-3 text-xs">
                  <span className="text-neutral-400 tabular-nums whitespace-nowrap shrink-0 w-32">
                    {fmtDateTime(entry.timestamp)}
                  </span>
                  <CategoryPill category={entry.category} />
                  <span className="flex-1 text-neutral-700 leading-relaxed">
                    {entry.description}
                    {entry.badge && (
                      <span className="ml-1.5 inline-flex items-center rounded bg-warning-500/10 px-1.5 py-0.5 text-[10px] font-medium text-warning-500">
                        {entry.badge}
                      </span>
                    )}
                  </span>
                  <span className="text-neutral-500 whitespace-nowrap shrink-0">{entry.user}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-3 lg:sticky lg:top-4 self-start">
          {/* Ingest info */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-2.5">
            <div>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500">
                {t('sidebar.ingested')}
              </div>
              <div className="mt-0.5 text-xs text-neutral-900">{fmtDateTime(period.ingestedAt)}</div>
              <div className="text-[11px] text-neutral-500">{period.ingestedBy}</div>
            </div>
            {period.finalizedAt && period.finalizedBy && (
              <div className="pt-2 border-t border-neutral-100">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500">
                  {t('sidebar.finalized')}
                </div>
                <div className="mt-0.5 text-xs text-neutral-900">{fmtDateTime(period.finalizedAt)}</div>
                <div className="text-[11px] text-neutral-500">{period.finalizedBy}</div>
              </div>
            )}
          </div>

          {/* Period close panel */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900 mb-2">
              {period.status === 'Locked' ? (
                <Lock className="h-3.5 w-3.5 text-info-500" />
              ) : (
                <Unlock className="h-3.5 w-3.5 text-neutral-500" />
              )}
              {t('sidebar.periodClose')}
            </div>
            <ul className="text-[11px] text-neutral-600 space-y-1 leading-relaxed">
              {period.status === 'Locked' ? (
                <>
                  <li>✓ {t('sidebar.lockedItems.1')}</li>
                  <li>✓ {t('sidebar.lockedItems.2')}</li>
                  <li>✓ {t('sidebar.lockedItems.3')}</li>
                  <li>✓ {t('sidebar.lockedItems.4')}</li>
                </>
              ) : period.status === 'Finalized' ? (
                <>
                  <li>● {t('sidebar.finalizedItems.1')}</li>
                  <li>● {t('sidebar.finalizedItems.2')}</li>
                </>
              ) : (
                <>
                  <li>○ {t('sidebar.draftItems.1')}</li>
                  <li>○ {t('sidebar.draftItems.2')}</li>
                </>
              )}
            </ul>
            {period.status === 'Finalized' && (
              <p className="mt-2 text-[10px] text-neutral-400">
                {t('sidebar.finalizedFootnote')}
              </p>
            )}
          </div>

          {/* Downstream lineage */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900 mb-2">
              <GitBranch className="h-3.5 w-3.5 text-neutral-500" />
              {t('sidebar.downstreamReports')}
            </div>
            <ul className="text-[11px] space-y-1.5">
              {period.downstreamReports.map((r) => (
                <li key={r}>
                  <span className="text-info-500 hover:text-info-500/80 cursor-pointer">
                    → {r}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      {manualEditOpen && (
        <ManualInputEditModal
          periodKey={period.periodKey}
          periodLabel={period.label}
          initial={period.manualInputs}
          snapshotRef={
            period.year != null
              ? {
                  granularity: period.granularity === 'week' ? 'WEEKLY' : 'MONTHLY',
                  weekNum: period.weekNum ?? undefined,
                  monthIdx: period.monthIdx ?? undefined,
                  year: period.year,
                }
              : undefined
          }
          onClose={() => setManualEditOpen(false)}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Pieces
// ----------------------------------------------------------------------------

function Section({
  icon,
  title,
  sub,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  sub?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-neutral-100">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        </div>
        {sub && <div className="text-[11px] text-neutral-500">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function FileRow({
  file,
  expanded,
  onToggle,
}: {
  file: ArchiveFile;
  expanded: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations('rawArchive.detail');
  const tIcon = useTranslations('rawArchive.iconBtn');
  const hasHistory = !!file.replacedVersions && file.replacedVersions.length > 0;
  return (
    <li className="px-4 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={hasHistory ? onToggle : undefined}
            className={cn(
              'shrink-0',
              hasHistory ? 'cursor-pointer text-neutral-500' : 'cursor-default text-transparent',
            )}
            aria-label={hasHistory ? t('fileToggleAria') : undefined}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          <PlatformBadge platform={file.platform} />
          <div className="min-w-0">
            <div className="font-mono text-xs text-neutral-900 truncate">{file.filename}</div>
            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-neutral-500">
              <span className="font-semibold uppercase">{file.source}</span>
              <span>·</span>
              <span title={file.checksum} className="font-mono">
                sha256: {file.checksum.slice(0, 8)}…
              </span>
              {hasHistory && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-0.5 text-warning-500">
                    <History className="h-2.5 w-2.5" />
                    {file.replacedVersions!.length === 1
                      ? t('priorVersionInline', { count: file.replacedVersions!.length })
                      : t('priorVersionsInline', { count: file.replacedVersions!.length })}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs tabular-nums text-neutral-700">
            <span className="font-semibold">{file.rows.toLocaleString('en-US')}</span>{' '}
            <span className="text-[10px] uppercase text-neutral-500">{t('rowsSuffix')}</span>
          </span>
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] tabular-nums text-neutral-600">
            {fmtBytes(file.bytes)}
          </span>
          <button
            type="button"
            onClick={() => downloadArchiveFile(file)}
            title={tIcon('download')}
            className="inline-flex items-center gap-1 rounded-md bg-info-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-info-500/90"
          >
            <Download className="h-3 w-3" />
            {t('download')}
          </button>
        </div>
      </div>

      {expanded && hasHistory && (
        <div className="mt-2 ml-6 rounded-md border border-warning-500/20 bg-warning-500/5 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-warning-500 mb-1.5">
            {t('priorVersionsTitle')}
          </div>
          <ul className="space-y-1.5">
            {file.replacedVersions!.map((v, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 text-[11px] text-neutral-600"
              >
                <span className="font-mono">{fmtDateTime(v.uploadedAt)}</span>
                <span className="text-neutral-500">{v.uploadedBy}</span>
                <span className="tabular-nums">{t('rowsCount', { count: v.rows.toLocaleString('en-US') })}</span>
                <span className="tabular-nums text-neutral-500">{fmtBytes(v.bytes)}</span>
                <span className="font-mono text-neutral-400">{v.checksum.slice(0, 8)}…</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

function PlatformBadge({ platform }: { platform: 'Shopee' | 'TikTok Shop' }) {
  const isShopee = platform === 'Shopee';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap shrink-0',
        isShopee ? 'bg-shopee text-white' : 'bg-neutral-900 text-white',
      )}
    >
      <span className="font-mono">{isShopee ? 'S' : 'T'}</span>
      {platform}
    </span>
  );
}

function StatusBadge({ status }: { status: PeriodStatus }) {
  const t = useTranslations('rawArchive.status');
  const map: Record<PeriodStatus, { cls: string; dot: string; key: 'draft' | 'finalized' | 'locked' }> = {
    Draft: { cls: 'bg-neutral-100 text-neutral-600', dot: 'bg-neutral-400', key: 'draft' },
    Finalized: { cls: 'bg-success-500/10 text-success-500', dot: 'bg-success-500', key: 'finalized' },
    Locked: { cls: 'bg-info-50 text-info-500', dot: 'bg-info-500', key: 'locked' },
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
        map[status].cls,
      )}
    >
      <span className={cn('inline-block h-2 w-2 rounded-full', map[status].dot)} />
      {t(map[status].key)}
    </span>
  );
}

function StatTile({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  sub: string;
  tone?: 'neutral' | 'info' | 'warning';
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500">
        {label}
      </div>
      <div
        className={cn(
          'mt-1 text-xl font-bold tabular-nums',
          tone === 'info' && 'text-info-500',
          tone === 'warning' && 'text-warning-500',
          tone === 'neutral' && 'text-neutral-900',
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-neutral-500">{sub}</div>
    </div>
  );
}

function CategoryPill({ category }: { category: string }) {
  const map: Record<string, string> = {
    UPLOAD: 'bg-info-50 text-info-500',
    MANUAL_INPUT: 'bg-accent-50 text-accent-700',
    INGEST: 'bg-success-500/10 text-success-500',
    APPROVAL: 'bg-warning-500/10 text-warning-500',
    FINALIZE: 'bg-neutral-900 text-white',
    REPLACE: 'bg-warning-500/10 text-warning-500',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold whitespace-nowrap shrink-0',
        map[category] ?? 'bg-neutral-100 text-neutral-600',
      )}
    >
      {category}
    </span>
  );
}

function fmtBytes(b: number): string {
  if (b >= 1_000_000) return `${(b / 1_000_000).toFixed(1)} MB`;
  if (b >= 1_000) return `${(b / 1_000).toFixed(0)} KB`;
  return `${b} B`;
}
