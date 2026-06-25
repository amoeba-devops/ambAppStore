'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Copy, Download, Upload, Plus, Search, Trash2, Pencil, Calendar } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@v2/ui';
import { DEFAULT_VND_PER_KRW, fmtDate, fmtTime } from '@/lib/format';
import { useFxRateOverride } from '@/lib/fx-rate-override';
import {
  broadcastMutation,
  useRevalidateOnMutation,
} from '@/lib/data-revalidation';
import { FxRateEditor } from '@/components/shared/FxRateEditor';
import { downloadCsv } from '@/lib/csv';
import {
  listFlatVersionsAction,
  listPrimeCostsAction,
  exportPrimeCostsAction,
  importPrimeCostsAction,
  addPrimeCostVersionAction,
  addSellingPriceVersionAction,
  addListingPriceVersionAction,
  softDeletePrimeCostVersionAction,
  softDeleteSellingPriceVersionAction,
  softDeleteListingPriceVersionAction,
  type FlatVersionRow,
  type PrimeCostRow,
  type ImportResult,
} from '@/server/actions/prime-cost.actions';
import { PrimeCostFormModal } from './PrimeCostFormModal';
import { formatSkuMultiline } from '@/lib/sku-format';

export type PriceField = 'prime' | 'selling' | 'listing';

function fmtVnd(value: number | null): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('vi-VN').format(Math.round(value));
}
function fmtKrwAt(vnd: number | null, rate: number): string {
  if (vnd == null) return '—';
  return new Intl.NumberFormat('ko-KR').format(Math.round(vnd / rate));
}

interface Props {
  field: PriceField;
  /** Server-fetched first page of versions. */
  initialVersions: FlatVersionRow[];
  /** Live VND-per-KRW rate, fetched server-side from `sal_fx_rates`. */
  vndPerKrw?: number;
}

/**
 * Shared page client for the 3 price-versioning views:
 * - `/cost-master/prime-cost`     (field='prime')
 * - `/cost-master/selling-price`  (field='selling')
 * - `/cost-master/listing-price`  (field='listing')
 *
 * Primary content: flat list of versions DESC by `effectiveFrom`, one row per
 * version. SKU master CRUD piggybacks via the SKU-code link in each row.
 */
export function PriceVersionPageClient({ field, initialVersions, vndPerKrw }: Props) {
  const { rate: krwRate, override, setOverride } = useFxRateOverride(
    vndPerKrw ?? DEFAULT_VND_PER_KRW,
  );
  const fmtKrw = (vnd: number | null) => fmtKrwAt(vnd, krwRate);
  const t = useTranslations('priceVersion');
  const tMaster = useTranslations('primeCost');
  const tCommon = useTranslations('common');
  // Reuse productList.filter.* keys (date range, "All updaters") so the
  // 3 price pages stay aligned with Product List terminology.
  const tProductList = useTranslations('productList');
  const [rows, setRows] = useState<FlatVersionRow[]>(initialVersions);
  const [search, setSearch] = useState('');
  const [comboFilter, setComboFilter] = useState<'ALL' | 'COMBO' | 'NON_COMBO'>('ALL');
  const [updatedFrom, setUpdatedFrom] = useState<string>('');
  const [updatedTo, setUpdatedTo] = useState<string>('');
  const [updatedByFilter, setUpdatedByFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; msg: string } | null>(null);
  const [editingSku, setEditingSku] = useState<PrimeCostRow | null>(null);
  // When set (and `editingSku` is null), the SKU modal opens in "Duplicate"
  // mode: form pre-filled from this source row, but action INSERTs a new
  // master row (no pcsId). Set by the row-level Copy button.
  const [duplicateSource, setDuplicateSource] = useState<PrimeCostRow | null>(null);
  const [skuModalOpen, setSkuModalOpen] = useState(false);
  const [addVersionOpen, setAddVersionOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await listFlatVersionsAction({ field });
    setLoading(false);
    if (!res.success) {
      setFeedback({ tone: 'error', msg: res.error.message });
      return;
    }
    setRows(res.data.rows);
  }, [field]);

  // Listen for cost-master mutations from other tabs/pages.
  useRevalidateOnMutation(['cost-master']);

  useEffect(() => {
    if (!feedback) return;
    const handle = setTimeout(() => setFeedback(null), 3000);
    return () => clearTimeout(handle);
  }, [feedback]);

  // Unique createdByDisplay values present in the current dataset — drives
  // the Updated By <select>. Sorted alphabetically.
  const updatedByOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.createdByDisplay) set.add(r.createdByDisplay);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromDate = updatedFrom || null;
    const toDate = updatedTo || null;
    return rows.filter((r) => {
      if (comboFilter === 'COMBO' && !r.isCombo) return false;
      if (comboFilter === 'NON_COMBO' && r.isCombo) return false;
      // Last-Updated date range — uses the version's createdAt (per-version
      // timestamp), not effectiveFrom. ISO prefix = local-UTC day.
      if (fromDate || toDate) {
        const day = r.createdAt.slice(0, 10);
        if (fromDate && day < fromDate) return false;
        if (toDate && day > toDate) return false;
      }
      // Updated By — match on per-version author display name.
      if (updatedByFilter !== 'ALL' && r.createdByDisplay !== updatedByFilter) return false;
      if (q) {
        // Search matches across SKU code, product names, variation name,
        // AND component SKUs (so admin can paste a component string from
        // Shopee and locate the parent combo SKU).
        if (r.skuCode.toLowerCase().includes(q)) return true;
        if (r.productNameVi.toLowerCase().includes(q)) return true;
        if ((r.productNameEn ?? '').toLowerCase().includes(q)) return true;
        if ((r.variationName ?? '').toLowerCase().includes(q)) return true;
        if (r.componentSkus && r.componentSkus.length > 0) {
          // Match against each component SKU individually AND the joined
          // string (so admin can paste either "SAFG20U0014" or the full
          // "SAFG20U0014_SAFG20U0012_..." concat).
          const joined = r.componentSkus.join('_').toLowerCase();
          if (joined.includes(q)) return true;
          if (r.componentSkus.some((c) => c.toLowerCase().includes(q))) return true;
        }
        return false;
      }
      return true;
    });
  }, [rows, search, comboFilter, updatedFrom, updatedTo, updatedByFilter]);

  /**
   * Group filtered version rows by `pcsId`. Each group is sorted DESC by
   * effective_from (matches the order the server returns). Latest version is
   * shown in the primary row; older versions render as collapsible sub-rows.
   */
  const groups = useMemo(() => {
    const byPcs = new Map<string, FlatVersionRow[]>();
    for (const r of filtered) {
      const arr = byPcs.get(r.pcsId) ?? [];
      arr.push(r);
      byPcs.set(r.pcsId, arr);
    }
    return [...byPcs.entries()].map(([pcsId, versions]) => ({
      pcsId,
      latest: versions[0]!,
      versions,
    }));
  }, [filtered]);

  const toggleExpanded = (pcsId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(pcsId)) next.delete(pcsId);
      else next.add(pcsId);
      return next;
    });
  };

  const openAddSku = () => {
    setEditingSku(null);
    setDuplicateSource(null);
    setSkuModalOpen(true);
  };

  const openEditSku = async (pcsId: string) => {
    // Load the full PrimeCostRow for the modal — we have pcsId from the version row.
    const res = await listPrimeCostsAction({ search: '' });
    if (res.success) {
      const found = res.data.rows.find((r) => r.pcsId === pcsId);
      if (found) {
        setDuplicateSource(null);
        setEditingSku(found);
        setSkuModalOpen(true);
      }
    }
  };

  /** Open modal in Duplicate mode — same form data but stays in Add path. */
  const openDuplicateSku = async (pcsId: string) => {
    const res = await listPrimeCostsAction({ search: '' });
    if (res.success) {
      const found = res.data.rows.find((r) => r.pcsId === pcsId);
      if (found) {
        setEditingSku(null);
        setDuplicateSource(found);
        setSkuModalOpen(true);
      }
    }
  };

  const onSkuSaved = () => {
    setSkuModalOpen(false);
    setFeedback({ tone: 'success', msg: editingSku ? tMaster('rowUpdated') : tMaster('rowAdded') });
    broadcastMutation('cost-master');
    void refresh();
  };

  const onDownload = async () => {
    setDownloading(true);
    const res = await exportPrimeCostsAction({ field });
    setDownloading(false);
    if (!res.success) {
      setFeedback({ tone: 'error', msg: res.error.message });
      return;
    }
    downloadCsv(res.data.csv, res.data.filename);
    setFeedback({ tone: 'success', msg: tMaster('downloadedCount', { count: res.data.count }) });
  };

  const onUploadClick = () => fileInputRef.current?.click();

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ tone: 'error', msg: tMaster('fileTooLarge') });
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
      broadcastMutation('cost-master');
      void refresh();
    } finally {
      setImporting(false);
    }
  };

  const onDeleteVersion = async (row: FlatVersionRow) => {
    if (!confirm(t('delete.confirm', { date: row.effectiveFrom, sku: row.skuCode }))) return;
    setDeletingId(row.versionId);
    let res;
    if (field === 'prime') {
      res = await softDeletePrimeCostVersionAction({ pcvId: row.versionId });
    } else if (field === 'selling') {
      res = await softDeleteSellingPriceVersionAction({ spvId: row.versionId });
    } else {
      res = await softDeleteListingPriceVersionAction({ lpvId: row.versionId });
    }
    setDeletingId(null);
    if (!res.success) {
      setFeedback({ tone: 'error', msg: res.error.message });
      return;
    }
    setFeedback({ tone: 'success', msg: t('delete.success') });
    broadcastMutation('cost-master');
    void refresh();
  };

  return (
    <div className="space-y-4">
      {/* Title row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{t(`title.${field}`)}</h1>
          <p className="mt-1 text-sm text-neutral-500">{t(`subtitle.${field}`)}</p>
        </div>
        <div className="shrink-0 rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700">
          <FxRateEditor rate={krwRate} override={override} onSet={setOverride} />
        </div>
      </div>

      {/* Toolbar — filters on row 1, actions on row 2. */}
      <div className="space-y-3 rounded-lg border border-neutral-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full rounded-md border border-neutral-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none"
            />
          </div>
          <select
            value={comboFilter}
            onChange={(e) => setComboFilter(e.target.value as typeof comboFilter)}
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-sm text-neutral-700 focus:border-neutral-500 focus:outline-none"
          >
            <option value="ALL">{t('comboFilter.all')}</option>
            <option value="COMBO">{t('comboFilter.combo')}</option>
            <option value="NON_COMBO">{t('comboFilter.nonCombo')}</option>
          </select>
          {/* Last-Updated date range — filters per-version createdAt. */}
          <div className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm">
            <input
              type="date"
              value={updatedFrom}
              onChange={(e) => setUpdatedFrom(e.target.value)}
              title={tProductList('filter.updatedFrom')}
              className="w-[7.5rem] rounded px-1 py-0.5 text-xs focus:outline-none"
            />
            <span className="text-xs text-neutral-400">–</span>
            <input
              type="date"
              value={updatedTo}
              onChange={(e) => setUpdatedTo(e.target.value)}
              title={tProductList('filter.updatedTo')}
              className="w-[7.5rem] rounded px-1 py-0.5 text-xs focus:outline-none"
            />
            {(updatedFrom || updatedTo) && (
              <button
                type="button"
                onClick={() => {
                  setUpdatedFrom('');
                  setUpdatedTo('');
                }}
                className="ml-0.5 rounded px-1 text-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                title={tProductList('filter.clearDates')}
              >
                ×
              </button>
            )}
          </div>
          {/* Updated By filter */}
          <select
            value={updatedByFilter}
            onChange={(e) => setUpdatedByFilter(e.target.value)}
            className="max-w-[10rem] rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-sm text-neutral-700 focus:border-neutral-500 focus:outline-none"
          >
            <option value="ALL">{tProductList('filter.updatedByAll')}</option>
            {updatedByOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-neutral-500">
            {t('footer.groupedCount', {
              skus: groups.length,
              versions: filtered.length,
              total: rows.length,
            })}
          </span>
          <div className="flex flex-wrap items-center gap-2">
          <ToolbarButton icon={<Download className="h-4 w-4" />} onClick={onDownload} disabled={downloading}>
            {downloading ? tMaster('downloading') : tMaster('download')}
          </ToolbarButton>
          <ToolbarButton
            icon={<Upload className="h-4 w-4" />}
            onClick={onUploadClick}
            disabled={importing}
            title={tMaster('uploadTooltip')}
          >
            {importing ? tMaster('uploading') : tMaster('upload')}
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
            onClick={openAddSku}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <Plus className="h-4 w-4" />
            {t('action.addSku')}
          </button>
          <button
            type="button"
            onClick={() => setAddVersionOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-3 py-2 text-sm font-medium text-white hover:bg-accent-700/90"
          >
            <Plus className="h-4 w-4" />
            {t('action.addVersion')}
          </button>
          </div>
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

      {/* Flat version list */}
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-2.5 py-3 text-left font-medium">{t('column.sku')}</th>
                <th className="px-2.5 py-3 text-left font-medium">{t('column.productVi')}</th>
                <th className="px-2.5 py-3 text-left font-medium">{t('column.variationName')}</th>
                <th className="px-2.5 py-3 text-right font-medium">{t(`field.${field}`)}</th>
                <th className="px-2.5 py-3 text-left font-medium">{t('column.effectiveFrom')}</th>
                <th className="px-2.5 py-3 text-left font-medium">{t('column.createdAt')}</th>
                <th className="px-2.5 py-3 text-left font-medium">{t('column.updatedBy')}</th>
                <th className="px-2.5 py-3 text-left font-medium">{t('column.sourceNote')}</th>
                <th className="px-2.5 py-3 text-right font-medium">{tMaster('column.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-neutral-500">
                    {tCommon('loading')}
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-neutral-500">
                    {search ? t('empty.search') : t('empty.initial')}
                  </td>
                </tr>
              )}
              {groups.map((g) => {
                const isExpanded = expanded.has(g.pcsId);
                const hasMore = g.versions.length > 1;
                const latest = g.latest;
                const older = g.versions.slice(1);
                return (
                  <Fragment key={g.pcsId}>
                    {/* Primary row — latest version */}
                    <tr className="hover:bg-neutral-50/60">
                      <td className="px-2.5 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {hasMore ? (
                            <button
                              type="button"
                              onClick={() => toggleExpanded(g.pcsId)}
                              className="rounded p-0.5 text-neutral-500 hover:bg-neutral-100"
                              title={isExpanded ? t('group.collapse') : t('group.expand', { count: g.versions.length })}
                            >
                              <ChevronRight
                                className={cn(
                                  'h-3.5 w-3.5 transition-transform',
                                  isExpanded && 'rotate-90',
                                )}
                              />
                            </button>
                          ) : (
                            <span className="inline-block w-[18px]" />
                          )}
                          <button
                            type="button"
                            onClick={() => openEditSku(latest.pcsId)}
                            className="text-left text-info-500 hover:underline"
                            title={t('action.editSku')}
                          >
                            <code className="inline-block rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-700 whitespace-pre-line leading-tight hover:text-info-500">
                              {formatSkuMultiline(latest.skuCode)}
                            </code>
                          </button>
                          {hasMore && (
                            <span className="inline-flex items-center rounded-full bg-info-50 px-1.5 py-0.5 text-[10px] font-medium text-info-500">
                              {t('group.versionCount', { count: g.versions.length })}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="max-w-[200px] px-2.5 py-3 text-xs text-neutral-900">
                        <div className="flex items-start gap-1.5">
                          <span>{latest.productNameVi}</span>
                          {latest.isCombo && (
                            <span className="inline-flex shrink-0 items-center rounded-full bg-warning-50 px-1.5 py-0.5 text-[10px] font-medium text-warning-500">
                              {t('badge.combo')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="max-w-[140px] px-2.5 py-3 text-xs text-neutral-700">
                        {latest.variationName ?? tCommon('dash')}
                      </td>
                      <td className="px-2.5 py-3 text-right font-mono tabular-nums text-neutral-900">
                        <div className="font-semibold">{fmtVnd(latest.valueVnd)}</div>
                        <div className="text-[11px] text-neutral-500">{fmtKrw(latest.valueVnd)}</div>
                      </td>
                      <td className="px-2.5 py-3 font-mono text-xs whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-neutral-400" />
                          {fmtDate(latest.effectiveFrom)}
                        </span>
                      </td>
                      <td className="px-2.5 py-3 font-mono text-[11px] text-neutral-500 whitespace-nowrap leading-tight">
                        <div>{fmtDate(latest.createdAt)}</div>
                        <div className="text-neutral-400">{fmtTime(latest.createdAt)}</div>
                      </td>
                      <td className="px-2.5 py-3 text-xs text-neutral-700 whitespace-nowrap">
                        {latest.createdByDisplay}
                      </td>
                      <td className="max-w-[150px] px-2.5 py-3 text-xs text-neutral-600">
                        {latest.sourceNote ?? tCommon('dash')}
                      </td>
                      <td className="px-2.5 py-3 whitespace-nowrap">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditSku(latest.pcsId)}
                            title={t('action.editSku')}
                            className="inline-flex shrink-0 items-center justify-center rounded-md border border-neutral-300 bg-white p-1.5 text-neutral-700 hover:bg-neutral-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openDuplicateSku(latest.pcsId)}
                            title={t('action.duplicateSku')}
                            className="inline-flex shrink-0 items-center justify-center rounded-md border border-neutral-300 bg-white p-1.5 text-neutral-700 hover:bg-neutral-50"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteVersion(latest)}
                            disabled={deletingId === latest.versionId}
                            title={t('action.deleteVersion')}
                            className="inline-flex shrink-0 items-center justify-center rounded-md border border-error-500 bg-white p-1.5 text-error-500 hover:bg-error-50 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Older versions — sub-rows when expanded */}
                    {isExpanded &&
                      older.map((v) => (
                        <tr key={v.versionId} className="bg-neutral-100 hover:bg-neutral-150">
                          <td className="px-2.5 py-2" />
                          <td className="px-2.5 py-2" />
                          <td className="px-2.5 py-2" />
                          <td className="px-2.5 py-2 text-right font-mono tabular-nums text-neutral-700">
                            <div>{fmtVnd(v.valueVnd)}</div>
                            <div className="text-[11px] text-neutral-500">{fmtKrw(v.valueVnd)}</div>
                          </td>
                          <td className="px-2.5 py-2 font-mono text-xs whitespace-nowrap text-neutral-600">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-neutral-400" />
                              {fmtDate(v.effectiveFrom)}
                            </span>
                          </td>
                          <td className="px-2.5 py-2 font-mono text-[11px] text-neutral-500 whitespace-nowrap leading-tight">
                            <div>{fmtDate(v.createdAt)}</div>
                            <div className="text-neutral-400">{fmtTime(v.createdAt)}</div>
                          </td>
                          <td className="px-2.5 py-2 text-xs text-neutral-700 whitespace-nowrap">
                            {v.createdByDisplay}
                          </td>
                          <td className="max-w-[150px] px-2.5 py-2 text-xs text-neutral-600">
                            {v.sourceNote ?? tCommon('dash')}
                          </td>
                          <td className="px-2.5 py-2 whitespace-nowrap">
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => onDeleteVersion(v)}
                                disabled={deletingId === v.versionId}
                                title={t('action.deleteVersion')}
                                className="inline-flex shrink-0 items-center justify-center rounded-md border border-error-500 bg-white p-1.5 text-error-500 hover:bg-error-50 disabled:opacity-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-2.5 text-xs text-neutral-500">
          {t('footer.groupedCount', {
            skus: groups.length,
            versions: filtered.length,
            total: rows.length,
          })}
        </div>
      </div>

      <PrimeCostFormModal
        open={skuModalOpen}
        initial={editingSku}
        prefill={duplicateSource}
        onClose={() => setSkuModalOpen(false)}
        onSaved={onSkuSaved}
        priceField={field}
      />

      {addVersionOpen && (
        <AddVersionForFieldModal
          field={field}
          onClose={() => setAddVersionOpen(false)}
          onSaved={async () => {
            setAddVersionOpen(false);
            broadcastMutation('cost-master');
            await refresh();
          }}
        />
      )}

      {importSummary && (
        <ImportResultModal summary={importSummary} onClose={() => setImportSummary(null)} />
      )}
    </div>
  );
}

interface AddVersionForFieldModalProps {
  field: PriceField;
  onClose: () => void;
  onSaved: () => void;
}

function AddVersionForFieldModal({ field, onClose, onSaved }: AddVersionForFieldModalProps) {
  const t = useTranslations('priceVersion');
  const tCommon = useTranslations('common');
  const tMaster = useTranslations('primeCost');
  const [skus, setSkus] = useState<PrimeCostRow[]>([]);
  const [pcsId, setPcsId] = useState('');
  const [skuSearch, setSkuSearch] = useState('');
  const todayIso = new Date().toISOString().slice(0, 10);
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso);
  const [value, setValue] = useState('');
  const [sourceNote, setSourceNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listPrimeCostsAction({ search: '' }).then((res) => {
      if (res.success) setSkus(res.data.rows);
    });
  }, []);

  const filteredSkus = useMemo(() => {
    const q = skuSearch.trim().toLowerCase();
    if (!q) return skus.slice(0, 50);
    return skus
      .filter(
        (s) =>
          s.skuCode.toLowerCase().includes(q) ||
          s.productNameVi.toLowerCase().includes(q) ||
          (s.productNameEn ?? '').toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [skus, skuSearch]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!pcsId) {
      setError(t('error.skuRequired'));
      return;
    }
    // Strip thousand separators (comma OR dot — VN typing convention) + spaces.
    const v = Number(value.replace(/[,.\s]/g, ''));
    if (!Number.isFinite(v) || v < 0) {
      setError(tMaster('version.error.primeCostInvalid'));
      return;
    }
    setSubmitting(true);
    let res;
    if (field === 'prime') {
      res = await addPrimeCostVersionAction({
        pcsId,
        effectiveFrom,
        primeCostVnd: v,
        breakdown: null,
        sourceNote: sourceNote.trim() || null,
      });
    } else if (field === 'selling') {
      res = await addSellingPriceVersionAction({
        pcsId,
        effectiveFrom,
        valueVnd: v,
        sourceNote: sourceNote.trim() || null,
      });
    } else {
      res = await addListingPriceVersionAction({
        pcsId,
        effectiveFrom,
        valueVnd: v,
        sourceNote: sourceNote.trim() || null,
      });
    }
    setSubmitting(false);
    if (!res.success) {
      setError(res.error.message);
      return;
    }
    onSaved();
  };

  const selectedSku = skus.find((s) => s.pcsId === pcsId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-neutral-900">
            {t('addModal.title', { field: t(`field.${field}`) })}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
            aria-label={tCommon('close')}
          >
            ×
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 px-6 py-5">
          {/* SKU picker */}
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-500">
              {t('addModal.sku')} *
            </span>
            {selectedSku ? (
              <div className="flex items-center gap-2 rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm">
                <code className="inline-block rounded bg-neutral-100 px-1.5 py-0.5 text-xs whitespace-pre-line leading-tight">
                  {formatSkuMultiline(selectedSku.skuCode)}
                </code>
                <span className="flex-1 text-neutral-700">{selectedSku.productNameVi}</span>
                <button
                  type="button"
                  onClick={() => setPcsId('')}
                  className="text-xs text-neutral-500 underline"
                >
                  {tCommon('change') ?? 'Change'}
                </button>
              </div>
            ) : (
              <>
                <input
                  type="search"
                  value={skuSearch}
                  onChange={(e) => setSkuSearch(e.target.value)}
                  placeholder={t('addModal.skuSearch')}
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
                />
                {skuSearch && (
                  <div className="mt-1 max-h-56 overflow-y-auto rounded-md border border-neutral-200 bg-white">
                    {filteredSkus.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-neutral-500">{tCommon('empty')}</div>
                    ) : (
                      filteredSkus.map((s) => (
                        <button
                          key={s.pcsId}
                          type="button"
                          onClick={() => {
                            setPcsId(s.pcsId);
                            setSkuSearch('');
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-neutral-50"
                        >
                          <code className="inline-block rounded bg-neutral-100 px-1.5 py-0.5 text-xs whitespace-pre-line leading-tight">
                            {formatSkuMultiline(s.skuCode)}
                          </code>
                          <span className="truncate text-neutral-700">{s.productNameVi}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-500">
              {tMaster('version.effectiveFrom')} *
            </span>
            <input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              required
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
            />
            <span className="mt-1 block text-[11px] text-neutral-500">
              {tMaster('version.effectiveFromDesc')}
            </span>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-500">
              VND *
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="295000"
              required
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-right font-mono tabular-nums focus:border-neutral-500 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-500">
              {tMaster('version.sourceNote')}
            </span>
            <input
              type="text"
              value={sourceNote}
              onChange={(e) => setSourceNote(e.target.value)}
              placeholder="Batch BL-2026-05-20"
              maxLength={255}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
            />
          </label>

          {error && (
            <div className="rounded-md border border-error-500 bg-error-50 px-3 py-2 text-sm text-error-500">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-neutral-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            >
              {tCommon('cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || !pcsId}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {submitting ? tCommon('saving') : tCommon('save')}
            </button>
          </div>
        </form>
      </div>
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
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100" aria-label={tCommon('close')}>×</button>
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
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">{t('rowsSkipped')}</div>
              <ul className="space-y-1 text-xs text-neutral-700">
                {summary.errors.map((e, i) => (
                  <li key={i}>
                    <span className="font-mono text-neutral-500">{t('rowPrefix', { index: e.rowIndex })}</span>
                    {e.sku && <code className="ml-1 rounded bg-neutral-200 px-1">{e.sku}</code>} — {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="flex justify-end border-t border-neutral-200 px-6 py-3">
          <button type="button" onClick={onClose} className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">
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
