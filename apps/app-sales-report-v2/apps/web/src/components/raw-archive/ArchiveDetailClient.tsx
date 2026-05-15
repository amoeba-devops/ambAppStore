'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
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
import { cn } from '@v2/ui';
import { Pencil, Lock as LockIcon } from 'lucide-react';
import { fmtDateTime, fmtVND } from '@/lib/format';
import type { ArchivePeriod, ArchiveFile, PeriodStatus } from '@/lib/raw-archive-mock';
import { useEffectivePeriod } from '@/lib/raw-archive-state';
import { downloadArchiveFile, downloadPeriodBulk } from '@/lib/raw-archive-download';
import { ApprovalCard } from './ApprovalCard';
import { FilePreviewModal } from './FilePreviewModal';
import { ManualInputEditModal } from './ManualInputEditModal';

interface Props {
  period: ArchivePeriod;
}

export function ArchiveDetailClient({ period: basePeriod }: Props) {
  const period = useEffectivePeriod(basePeriod);
  const [manualEditOpen, setManualEditOpen] = useState(false);
  const canEditManual = period.status === 'Draft';
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<ArchiveFile | null>(null);

  return (
    <div className="space-y-4">
      {/* Breadcrumb + title */}
      <div>
        <Link
          href="/raw-archive"
          className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Raw Archive
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900 font-mono">
              Period {period.label}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {period.rangeLabel} ·{' '}
              <span className="capitalize">{period.granularity}ly snapshot</span>
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
            <StatTile label="Files" value={String(period.fileCount)} sub={`${period.shopeeCount} Shopee · ${period.tiktokCount} TikTok`} />
            <StatTile label="Rows" value={period.totalRows.toLocaleString('en-US')} sub="parsed successfully" />
            <StatTile
              label="Re-uploads"
              value={String(period.reuploadCount)}
              sub={period.reuploadCount === 0 ? 'none' : 'see file history'}
              tone={period.reuploadCount > 0 ? 'warning' : 'neutral'}
            />
            <StatTile
              label="Formula Config"
              value={period.formulaVersion}
              sub="snapshot at ingest"
              tone="info"
            />
          </div>

          {/* Files archived */}
          <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Files className="h-4 w-4 text-neutral-500" />
                <h3 className="text-sm font-semibold text-neutral-900">Files archived</h3>
                <span className="text-[11px] text-neutral-500">
                  stored at{' '}
                  <code className="font-mono text-neutral-700">
                    /raw/{new Date(period.ingestedAt).getUTCFullYear()}/{period.periodKey}/
                  </code>
                </span>
              </div>
              <button
                type="button"
                onClick={() => downloadPeriodBulk(period)}
                title="Bundle all files for this period into a single download"
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                <Download className="h-3 w-3" />
                Bulk download · {period.files.length} files
              </button>
            </div>
            <ul className="divide-y divide-neutral-100">
              {period.files.map((f) => (
                <FileRow
                  key={f.id}
                  file={f}
                  expanded={openFile === f.id}
                  onToggle={() => setOpenFile((cur) => (cur === f.id ? null : f.id))}
                  onPreview={() => setPreviewFile(f)}
                />
              ))}
            </ul>
          </div>

          {/* Manual Input */}
          <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-neutral-500" />
                <h3 className="text-sm font-semibold text-neutral-900">Manual Input</h3>
                {canEditManual ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-500/10 px-2 py-0.5 text-[10px] font-medium text-success-500">
                    Editable
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
                    <LockIcon className="h-2.5 w-2.5" />
                    Locked
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
                  Edit
                </button>
              ) : (
                <span className="text-[11px] text-neutral-500">
                  {period.status === 'Finalized'
                    ? 'Unfinalize to edit'
                    : period.status === 'Locked'
                      ? 'Admin override required'
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
                  <span className="text-neutral-600 truncate">{field}</span>
                  <span className="font-mono font-semibold text-neutral-900 tabular-nums whitespace-nowrap">
                    {fmtVND(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Formula Config snapshot */}
          <Section
            icon={<FileCode className="h-4 w-4 text-neutral-500" />}
            title="Formula Config snapshot"
            sub={`${period.formulaVersion} — snapshot taken at ${fmtDateTime(period.formulaSnapshotAt)}`}
          >
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-xs text-neutral-600 leading-relaxed">
                Read-only view of formula state when this period was ingested. Edits to Formula
                Config after ingest do NOT retroactively affect this snapshot (NFR-08).
              </p>
              <Link
                href="/settings/formula-config"
                className="shrink-0 inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                View formula snapshot
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </Section>

          {/* Activity log */}
          <Section
            icon={<Activity className="h-4 w-4 text-neutral-500" />}
            title="Activity log"
            sub={`${period.activityLog.length} entries`}
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
                Ingested
              </div>
              <div className="mt-0.5 text-xs text-neutral-900">{fmtDateTime(period.ingestedAt)}</div>
              <div className="text-[11px] text-neutral-500">{period.ingestedBy}</div>
            </div>
            {period.finalizedAt && period.finalizedBy && (
              <div className="pt-2 border-t border-neutral-100">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500">
                  Finalized
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
              Period close
            </div>
            <ul className="text-[11px] text-neutral-600 space-y-1 leading-relaxed">
              {period.status === 'Locked' ? (
                <>
                  <li>✓ Reports finalized — không recompute</li>
                  <li>✓ Raw files không xóa được</li>
                  <li>✓ Formula changes sau lock không retro affect</li>
                  <li>✓ Manual Input không edit được</li>
                </>
              ) : period.status === 'Finalized' ? (
                <>
                  <li>● Snapshot finalized by Manager</li>
                  <li>● Awaiting full lock (post-review)</li>
                </>
              ) : (
                <>
                  <li>○ Draft — pending Manager approval</li>
                  <li>○ Raw files preserved (NFR-06)</li>
                </>
              )}
            </ul>
            {period.status === 'Finalized' && (
              <p className="mt-2 text-[10px] text-neutral-400">
                Use the Approval card above to lock this period manually, or unfinalize to reopen.
              </p>
            )}
          </div>

          {/* Downstream lineage */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900 mb-2">
              <GitBranch className="h-3.5 w-3.5 text-neutral-500" />
              Downstream reports
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

      {/* File preview modal */}
      {previewFile && <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
      {manualEditOpen && (
        <ManualInputEditModal
          periodKey={period.periodKey}
          periodLabel={period.label}
          initial={period.manualInputs}
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
  onPreview,
}: {
  file: ArchiveFile;
  expanded: boolean;
  onToggle: () => void;
  onPreview: () => void;
}) {
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
            aria-label={hasHistory ? 'Toggle history' : undefined}
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
                    {file.replacedVersions!.length} prior version
                    {file.replacedVersions!.length > 1 ? 's' : ''}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs tabular-nums text-neutral-700">
            <span className="font-semibold">{file.rows.toLocaleString('en-US')}</span>{' '}
            <span className="text-[10px] uppercase text-neutral-500">rows</span>
          </span>
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] tabular-nums text-neutral-600">
            {fmtBytes(file.bytes)}
          </span>
          <button
            type="button"
            onClick={onPreview}
            title="Preview first 5 rows"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => downloadArchiveFile(file)}
            title="Download original file"
            className="inline-flex items-center gap-1 rounded-md bg-info-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-info-500/90"
          >
            <Download className="h-3 w-3" />
            Download
          </button>
        </div>
      </div>

      {expanded && hasHistory && (
        <div className="mt-2 ml-6 rounded-md border border-warning-500/20 bg-warning-500/5 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-warning-500 mb-1.5">
            Prior versions (replaced)
          </div>
          <ul className="space-y-1.5">
            {file.replacedVersions!.map((v, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 text-[11px] text-neutral-600"
              >
                <span className="font-mono">{fmtDateTime(v.uploadedAt)}</span>
                <span className="text-neutral-500">{v.uploadedBy}</span>
                <span className="tabular-nums">{v.rows.toLocaleString('en-US')} rows</span>
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
  const map: Record<PeriodStatus, { cls: string; dot: string }> = {
    Draft: { cls: 'bg-neutral-100 text-neutral-600', dot: 'bg-neutral-400' },
    Finalized: { cls: 'bg-success-500/10 text-success-500', dot: 'bg-success-500' },
    Locked: { cls: 'bg-info-50 text-info-500', dot: 'bg-info-500' },
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
        map[status].cls,
      )}
    >
      <span className={cn('inline-block h-2 w-2 rounded-full', map[status].dot)} />
      {status}
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
