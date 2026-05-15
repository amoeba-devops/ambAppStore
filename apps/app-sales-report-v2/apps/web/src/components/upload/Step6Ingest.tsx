'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Zap,
  Check,
  CheckCircle2,
  Archive,
  ArrowRight,
  Lock,
  GitBranch,
} from 'lucide-react';
import { cn } from '@v2/ui';
import { fmtVND } from '@/lib/format';
import type { SelectedPeriod } from './Step1Period';

interface Props {
  selectedPeriod?: SelectedPeriod | null;
}

interface IntegratedFile {
  platform: 'Shopee' | 'TikTok Shop';
  name: string;
  rows: number;
  bytes: number;
}

/** Mock file list — 9 platform exports (6 Shopee + 3 TikTok), matching wizard Step 2. */
function buildFileList(periodLabel: string): IntegratedFile[] {
  const range = '2026-04-27_to_05-03';
  return [
    // Shopee — 6 files
    { platform: 'Shopee', name: `Shopee_Sales_${periodLabel}_${range}.xlsx`, rows: 2841, bytes: 2_100_000 },
    { platform: 'Shopee', name: `Shopee_Traffic_${periodLabel}.xlsx`, rows: 712, bytes: 580_000 },
    { platform: 'Shopee', name: `Shopee_Ads_${periodLabel}.xlsx`, rows: 524, bytes: 600_000 },
    { platform: 'Shopee', name: `Shopee_Brand_Ads_${periodLabel}.xlsx`, rows: 38, bytes: 100_000 },
    { platform: 'Shopee', name: `Shopee_Off-Platform_Ads_${periodLabel}.xlsx`, rows: 124, bytes: 210_000 },
    { platform: 'Shopee', name: `Shopee_Affiliate_${periodLabel}.xlsx`, rows: 256, bytes: 350_000 },
    // TikTok Shop — 3 files
    { platform: 'TikTok Shop', name: `TikTok_Sales_Report_${periodLabel}.csv`, rows: 2128, bytes: 1_400_000 },
    { platform: 'TikTok Shop', name: `TikTok_Traffic_Report_${periodLabel}.csv`, rows: 803, bytes: 510_000 },
    { platform: 'TikTok Shop', name: `TikTok_Affiliate_Report_${periodLabel}.csv`, rows: 1124, bytes: 800_000 },
  ];
}

function fmtBytes(b: number): string {
  if (b >= 1_000_000) return `${(b / 1_000_000).toFixed(1)} MB`;
  if (b >= 1_000) return `${(b / 1_000).toFixed(1)} KB`;
  return `${b} B`;
}

function fmtNum(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

export function Step6Ingest({ selectedPeriod = null }: Props) {
  const periodLabel = selectedPeriod?.label ?? 'W18';

  const files = useMemo(() => buildFileList(periodLabel), [periodLabel]);
  const totalRows = files.reduce((s, f) => s + f.rows, 0);

  // Loading vs complete
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    let p = 0;
    const interval = setInterval(() => {
      p = Math.min(100, p + Math.random() * 6 + 2);
      setProgress(p);
      if (p >= 100) {
        clearInterval(interval);
        setTimeout(() => setDone(true), 400);
      }
    }, 120);
    return () => clearInterval(interval);
  }, [done]);

  const currentRows = Math.round((progress / 100) * totalRows);

  if (!done) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-info-50">
            <Zap className="h-6 w-6 text-info-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Integrating files…</h2>
            <p className="mt-1 text-xs text-neutral-500 tabular-nums">
              {fmtNum(currentRows)} / {fmtNum(totalRows)} rows ·{' '}
              <span className="font-mono">period {periodLabel}</span>
            </p>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-info-500 transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ---- Complete state ----
  const fileCount = files.length;
  const shopeeCount = files.filter((f) => f.platform === 'Shopee').length;
  const tiktokCount = fileCount - shopeeCount;
  const skuCount = 24; // mock — derived from sales rows after de-dup
  const cmVnd = 413_000_000; // mock — Contribution Margin for the period
  const archivePath = `/raw/${new Date().getFullYear()}/${periodLabel}/`;

  return (
    <div className="space-y-4">
      {/* Hero card */}
      <div className="rounded-xl border border-neutral-200 bg-white px-6 py-8 text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-success-500/10">
          <Check className="h-6 w-6 text-success-500" strokeWidth={3} />
        </div>
        <div className="mt-3 text-[10px] uppercase tracking-wider font-semibold text-success-500">
          Integration Complete
        </div>
        <h2 className="mt-1 text-xl font-semibold text-neutral-900">
          Period <span className="font-mono">{periodLabel}</span> is live
        </h2>
        <p className="mt-2 max-w-xl mx-auto text-sm text-neutral-500">
          {fmtNum(totalRows)} rows from {fileCount} files have been parsed, normalized, and joined
          with Master Data v12. Reports are recomputed and ready to review.
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

      {/* Stat tiles */}
      <div className="grid grid-cols-4 gap-3">
        <StatTile
          label="Files"
          value={fmtNum(fileCount)}
          sub={`${shopeeCount} Shopee · ${tiktokCount} TikTok`}
        />
        <StatTile label="Rows" value={fmtNum(totalRows)} sub="All parsed successfully" />
        <StatTile label="SKUs" value={fmtNum(skuCount)} sub="Matched against Master Data" />
        <StatTile
          label="CM"
          value={fmtVND(cmVnd)}
          valueClassName="text-info-500"
          sub={`Computed for ${periodLabel}`}
        />
      </div>

      {/* Files integrated */}
      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-100">
          <h3 className="text-sm font-semibold text-neutral-900">Files integrated</h3>
          <span className="text-[11px] text-neutral-500">
            archived to <code className="font-mono text-neutral-700">{archivePath}</code>
          </span>
        </div>
        <ul className="divide-y divide-neutral-100">
          {files.map((f) => (
            <li
              key={f.name}
              className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-neutral-50/60"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <CheckCircle2 className="h-4 w-4 text-success-500 shrink-0" />
                <PlatformBadge platform={f.platform} />
                <span className="font-mono text-xs text-neutral-700 truncate">{f.name}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-neutral-500 shrink-0 tabular-nums">
                <span>
                  <span className="font-semibold text-neutral-900">{fmtNum(f.rows)}</span>{' '}
                  <span className="text-[10px] uppercase">rows</span>
                </span>
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px]">
                  {fmtBytes(f.bytes)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Bottom cards */}
      <div className="grid grid-cols-2 gap-3">
        <InfoCard
          icon={<GitBranch className="h-3.5 w-3.5" />}
          title="Lineage"
          body={
            <>
              Activity log entry{' '}
              <code className="font-mono text-neutral-700">AL-761852</code> created. Raw files
              cannot be deleted by Operator.
            </>
          }
          linkLabel="View activity log"
          linkHref="/activity-log/action"
        />
        <InfoCard
          icon={<Lock className="h-3.5 w-3.5" />}
          title="Period close"
          body={
            <>
              When all manual costs are reconciled, a Manager can finalize{' '}
              <span className="font-mono">{periodLabel}</span> to lock the snapshot.
            </>
          }
          linkLabel="Open period close"
          linkHref="#"
        />
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  valueClassName,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500">
        {label}
      </div>
      <div
        className={cn(
          'mt-1 text-2xl font-bold tabular-nums text-neutral-900',
          valueClassName,
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-neutral-500">{sub}</div>}
    </div>
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

function InfoCard({
  icon,
  title,
  body,
  linkLabel,
  linkHref,
}: {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
  linkLabel: string;
  linkHref: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900">
        <span className="text-neutral-500">{icon}</span>
        {title}
      </div>
      <p className="mt-1.5 text-xs text-neutral-600 leading-relaxed">{body}</p>
      <Link
        href={linkHref}
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-info-500 hover:text-info-500/80"
      >
        {linkLabel}
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
