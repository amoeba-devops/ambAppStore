'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Upload, Plus, Search, Trash2, Pencil, History } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@v2/ui';
import { fmtDateTime } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';
import {
  listPrimeCostsAction,
  deletePrimeCostAction,
  exportPrimeCostsAction,
  importPrimeCostsAction,
  type PrimeCostRow,
  type ImportResult,
} from '@/server/actions/prime-cost.actions';
import { PrimeCostFormModal } from './PrimeCostFormModal';
import { VersionHistoryModal, type VersionTab } from './VersionHistoryModal';
import { isPrimeCostVersioningEnabled } from '@/lib/feature-flags';

const KRW_RATE = 17.543;

function fmtVnd(value: number | null): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('vi-VN').format(Math.round(value));
}

function fmtKrw(vnd: number | null): string {
  if (vnd == null) return '—';
  return new Intl.NumberFormat('ko-KR').format(Math.round(vnd / KRW_RATE));
}

interface PrimeCostTableProps {
  initialRows: PrimeCostRow[];
  initialTotal: number;
}

export function PrimeCostTable({ initialRows, initialTotal }: PrimeCostTableProps) {
  const t = useTranslations('primeCost');
  const tCommon = useTranslations('common');
  const [rows, setRows] = useState<PrimeCostRow[]>(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<PrimeCostRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [versionTarget, setVersionTarget] = useState<{ row: PrimeCostRow; tab: VersionTab } | null>(null);
  const versioningEnabled = isPrimeCostVersioningEnabled();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; msg: string } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const refresh = useCallback(async (q: string) => {
    setLoading(true);
    const res = await listPrimeCostsAction({ search: q || undefined });
    setLoading(false);
    if (res.success) {
      setRows(res.data.rows);
      setTotal(res.data.total);
    } else {
      setFeedback({ tone: 'error', msg: res.error.message });
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void refresh(search);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, refresh]);

  useEffect(() => {
    if (!feedback) return;
    const handle = setTimeout(() => setFeedback(null), 3000);
    return () => clearTimeout(handle);
  }, [feedback]);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (row: PrimeCostRow) => {
    setEditing(row);
    setModalOpen(true);
  };

  const onSaved = () => {
    setModalOpen(false);
    setFeedback({ tone: 'success', msg: editing ? t('rowUpdated') : t('rowAdded') });
    void refresh(search);
  };

  const onDownload = async () => {
    setDownloading(true);
    const res = await exportPrimeCostsAction();
    setDownloading(false);
    if (!res.success) {
      setFeedback({ tone: 'error', msg: res.error.message });
      return;
    }
    downloadCsv(res.data.csv, res.data.filename);
    setFeedback({ tone: 'success', msg: t('downloadedCount', { count: res.data.count }) });
  };

  const onUploadClick = () => {
    fileInputRef.current?.click();
  };

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so same file can be re-picked
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ tone: 'error', msg: t('fileTooLarge') });
      return;
    }
    setImporting(true);
    setImportSummary(null);
    try {
      const text = await file.text();
      const res = await importPrimeCostsAction({ csv: text });
      if (!res.success) {
        setFeedback({ tone: 'error', msg: res.error.message });
        return;
      }
      setImportSummary(res.data);
      void refresh(search);
    } finally {
      setImporting(false);
    }
  };

  const onDelete = async (row: PrimeCostRow) => {
    if (!confirm(t('confirmDelete', { name: row.productNameVi, sku: row.skuCode }))) return;
    setDeletingId(row.pcsId);
    const res = await deletePrimeCostAction({ pcsId: row.pcsId });
    setDeletingId(null);
    if (!res.success) {
      setFeedback({ tone: 'error', msg: res.error.message });
      return;
    }
    setFeedback({ tone: 'success', msg: t('rowDeleted') });
    void refresh(search);
  };

  const visibleCount = rows.length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full rounded-md border border-neutral-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none"
            />
          </div>
          <span className="hidden text-sm font-medium text-accent-700 sm:inline">{t('badge')}</span>
        </div>
        <div className="flex items-center gap-2">
          <ToolbarButton
            icon={<Download className="h-4 w-4" />}
            onClick={onDownload}
            disabled={downloading}
          >
            {downloading ? t('downloading') : t('download')}
          </ToolbarButton>
          <ToolbarButton
            icon={<Upload className="h-4 w-4" />}
            onClick={onUploadClick}
            disabled={importing}
            title={t('uploadTooltip')}
          >
            {importing ? t('uploading') : t('upload')}
          </ToolbarButton>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onFilePicked}
          />
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-3 py-2 text-sm font-medium text-white hover:bg-accent-700/90"
          >
            <Plus className="h-4 w-4" />
            {t('addRow')}
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={cn(
            'rounded-md border px-3 py-2 text-sm',
            feedback.tone === 'success'
              ? 'border-success-500 bg-success-50 text-success-500'
              : 'border-error-500 bg-error-50 text-error-500',
          )}
        >
          {feedback.msg}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{t('column.productId')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('column.variationId')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('column.productVi')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('column.productEn')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('column.sku')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('column.primeCostVnd')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('column.krw')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('column.sellingPrice')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('column.listingPrice')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('column.effectivePrime')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('column.effectiveSelling')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('column.effectiveListing')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('column.lastUpdated')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('column.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading && rows.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-4 py-8 text-center text-sm text-neutral-500">
                    {tCommon('loading')}
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-4 py-8 text-center text-sm text-neutral-500">
                    {search ? t('empty.search') : t('empty.initial')}
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.pcsId} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-mono text-xs text-neutral-500">{row.productId ?? tCommon('dash')}</td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-500">{row.variationId ?? tCommon('dash')}</td>
                  <td className="px-4 py-3 text-neutral-900">{row.productNameVi}</td>
                  <td className="px-4 py-3 text-neutral-700">{row.productNameEn ?? tCommon('dash')}</td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-700">{row.skuCode}</code>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-neutral-900">
                    {fmtVnd(row.primeCostVnd)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-neutral-500">
                    {fmtKrw(row.primeCostVnd)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-neutral-700">
                    {fmtVnd(row.sellingPriceVnd)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-neutral-700">
                    {fmtVnd(row.listingPriceVnd)}
                  </td>
                  <EffectiveCell
                    latest={row.effectiveFromLatest}
                    count={row.versionCount}
                    onClick={() => setVersionTarget({ row, tab: 'prime' })}
                    label={t('version.history.title')}
                    countLabel={(c) => t('column.versionCount', { count: c })}
                    dash={tCommon('dash')}
                  />
                  <EffectiveCell
                    latest={row.sellingEffectiveFromLatest}
                    count={row.sellingVersionCount}
                    onClick={() => setVersionTarget({ row, tab: 'selling' })}
                    label={t('version.history.title')}
                    countLabel={(c) => t('column.versionCount', { count: c })}
                    dash={tCommon('dash')}
                  />
                  <EffectiveCell
                    latest={row.listingEffectiveFromLatest}
                    count={row.listingVersionCount}
                    onClick={() => setVersionTarget({ row, tab: 'listing' })}
                    label={t('version.history.title')}
                    countLabel={(c) => t('column.versionCount', { count: c })}
                    dash={tCommon('dash')}
                  />
                  <td className="px-4 py-3 font-mono text-xs text-neutral-500 whitespace-nowrap">
                    {fmtDateTime(row.updatedAt)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex justify-end gap-1.5 whitespace-nowrap">
                      {versioningEnabled && (
                        <button
                          type="button"
                          onClick={() => setVersionTarget({ row, tab: 'prime' })}
                          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-info-500 bg-white px-2 py-1 text-xs font-medium text-info-500 hover:bg-info-50"
                          title={t('version.history.title')}
                        >
                          <History className="h-3 w-3" />
                          {t('row.versions')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                      >
                        <Pencil className="h-3 w-3" />
                        {t('row.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(row)}
                        disabled={deletingId === row.pcsId}
                        className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-error-500 bg-white px-2 py-1 text-xs font-medium text-error-500 hover:bg-error-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" />
                        {deletingId === row.pcsId ? t('row.deleting') : t('row.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50 px-4 py-2.5 text-xs text-neutral-500">
          <span>{t('footer.count', { visible: visibleCount, total })}</span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success-500" />
            {t('footer.versionControl')}
          </span>
        </div>
      </div>

      <PrimeCostFormModal
        open={modalOpen}
        initial={editing}
        onClose={() => setModalOpen(false)}
        onSaved={onSaved}
      />

      <VersionHistoryModal
        open={versionTarget != null}
        pcsId={versionTarget?.row.pcsId ?? null}
        skuLabel={versionTarget?.row.skuCode ?? ''}
        productName={versionTarget?.row.productNameVi ?? ''}
        initialTab={versionTarget?.tab}
        onClose={() => setVersionTarget(null)}
        onChanged={() => void refresh(search)}
      />

      {importSummary && (
        <ImportResultModal summary={importSummary} onClose={() => setImportSummary(null)} />
      )}
    </div>
  );
}

function ImportResultModal({ summary, onClose }: { summary: ImportResult; onClose: () => void }) {
  const t = useTranslations('primeCost.import');
  const tCommon = useTranslations('common');
  const hasErrors = summary.errors.length > 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-neutral-900">{t('title')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
            aria-label={tCommon('close')}
          >
            ×
          </button>
        </div>
        <div className="space-y-3 px-6 py-5 text-sm">
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label={t('inserted')} value={summary.inserted} tone="success" />
            <Stat label={t('updated')} value={summary.updated} tone="info" />
            <Stat label={t('errors')} value={summary.errors.length} tone={hasErrors ? 'error' : 'neutral'} />
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label={t('primeVersionsAdded')} value={summary.versionsAdded} tone="info" />
            <Stat label={t('sellingVersionsAdded')} value={summary.sellingVersionsAdded} tone="info" />
            <Stat label={t('listingVersionsAdded')} value={summary.listingVersionsAdded} tone="info" />
          </div>
          {hasErrors && (
            <div className="max-h-60 overflow-y-auto rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                {t('rowsSkipped')}
              </div>
              <ul className="space-y-1 text-xs text-neutral-700">
                {summary.errors.map((e, i) => (
                  <li key={i}>
                    <span className="font-mono text-neutral-500">
                      {t('rowPrefix', { index: e.rowIndex })}
                    </span>
                    {e.sku && <code className="ml-1 rounded bg-neutral-200 px-1">{e.sku}</code>} — {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="flex justify-end border-t border-neutral-200 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'success' | 'info' | 'error' | 'neutral' }) {
  const colors = {
    success: 'bg-success-50 text-success-500',
    info: 'bg-info-50 text-info-500',
    error: 'bg-error-50 text-error-500',
    neutral: 'bg-neutral-100 text-neutral-700',
  } as const;
  return (
    <div className={cn('rounded-md px-3 py-3', colors[tone])}>
      <div className="text-xs font-medium uppercase tracking-wider opacity-80">{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function EffectiveCell({
  latest,
  count,
  onClick,
  label,
  countLabel,
  dash,
}: {
  latest: string | null;
  count: number;
  onClick: () => void;
  label: string;
  countLabel: (n: number) => string;
  dash: string;
}) {
  if (!latest) {
    return <td className="px-4 py-3 font-mono text-xs text-neutral-400 whitespace-nowrap">{dash}</td>;
  }
  return (
    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
      <button
        type="button"
        onClick={onClick}
        title={label}
        className="text-neutral-900 hover:underline"
      >
        {latest}
      </button>
      {count > 1 && (
        <button
          type="button"
          onClick={onClick}
          className="ml-1.5 inline-flex items-center rounded-full bg-info-50 px-1.5 py-0.5 text-[10px] font-medium text-info-500 hover:bg-info-500/15"
          title={label}
        >
          {countLabel(count)}
        </button>
      )}
    </td>
  );
}

function ToolbarButton({
  icon,
  children,
  disabled,
  title,
  onClick,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium',
        disabled ? 'cursor-not-allowed text-neutral-400' : 'text-neutral-700 hover:bg-neutral-50',
      )}
    >
      {icon}
      {children}
    </button>
  );
}
