'use client';

import { useEffect, useState } from 'react';
import { Trash2, X, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@v2/ui';
import { fmtDateTime } from '@/lib/format';
import {
  addPrimeCostVersionAction,
  listPrimeCostVersionsAction,
  softDeletePrimeCostVersionAction,
  addSellingPriceVersionAction,
  listSellingPriceVersionsAction,
  softDeleteSellingPriceVersionAction,
  addListingPriceVersionAction,
  listListingPriceVersionsAction,
  softDeleteListingPriceVersionAction,
} from '@/server/actions/prime-cost.actions';

const KRW_RATE = 17.543;

function fmtVnd(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(value));
}
function fmtKrw(vnd: number): string {
  return new Intl.NumberFormat('ko-KR').format(Math.round(vnd / KRW_RATE));
}

export type VersionTab = 'prime' | 'selling' | 'listing';

interface UnifiedVersionRow {
  /** UUID — `pcvId` for prime, `spvId` for selling, `lpvId` for listing. */
  id: string;
  effectiveFrom: string;
  valueVnd: number;
  /** Prime-cost only — selling/listing have no breakdown. */
  breakdown: Record<string, unknown> | null;
  sourceNote: string | null;
  createdBy: string;
  createdAt: string;
}

interface VersionHistoryModalProps {
  open: boolean;
  pcsId: string | null;
  skuLabel: string;
  productName: string;
  initialTab?: VersionTab;
  onClose: () => void;
  /** Called after any successful add/delete so parent can refresh master list (cache cost). */
  onChanged?: () => void;
}

export function VersionHistoryModal({
  open,
  pcsId,
  skuLabel,
  productName,
  initialTab = 'prime',
  onClose,
  onChanged,
}: VersionHistoryModalProps) {
  const t = useTranslations('primeCost.version');
  const tCommon = useTranslations('common');
  const [activeTab, setActiveTab] = useState<VersionTab>(initialTab);
  const [versions, setVersions] = useState<UnifiedVersionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Reset tab to initial when modal opens for a new SKU
  useEffect(() => {
    if (open) setActiveTab(initialTab);
  }, [open, initialTab, pcsId]);

  const fetchVersions = async (pcsIdArg: string, tab: VersionTab): Promise<UnifiedVersionRow[]> => {
    if (tab === 'prime') {
      const res = await listPrimeCostVersionsAction({ pcsId: pcsIdArg });
      if (!res.success) throw new Error(res.error.message);
      return res.data.versions.map((v) => ({
        id: v.pcvId,
        effectiveFrom: v.effectiveFrom,
        valueVnd: v.primeCostVnd,
        breakdown: v.breakdown,
        sourceNote: v.sourceNote,
        createdBy: v.createdBy,
        createdAt: v.createdAt,
      }));
    }
    if (tab === 'selling') {
      const res = await listSellingPriceVersionsAction({ pcsId: pcsIdArg });
      if (!res.success) throw new Error(res.error.message);
      return res.data.versions.map((v) => ({
        id: v.spvId,
        effectiveFrom: v.effectiveFrom,
        valueVnd: v.sellingPriceVnd,
        breakdown: null,
        sourceNote: v.sourceNote,
        createdBy: v.createdBy,
        createdAt: v.createdAt,
      }));
    }
    const res = await listListingPriceVersionsAction({ pcsId: pcsIdArg });
    if (!res.success) throw new Error(res.error.message);
    return res.data.versions.map((v) => ({
      id: v.lpvId,
      effectiveFrom: v.effectiveFrom,
      valueVnd: v.listingPriceVnd,
      breakdown: null,
      sourceNote: v.sourceNote,
      createdBy: v.createdBy,
      createdAt: v.createdAt,
    }));
  };

  // Counts per tab — fetched once when modal opens, refreshed after add/delete
  const [counts, setCounts] = useState<{ prime: number; selling: number; listing: number }>({
    prime: 0,
    selling: 0,
    listing: 0,
  });

  const reloadCounts = async (pcsIdArg: string) => {
    const [p, s, l] = await Promise.all([
      listPrimeCostVersionsAction({ pcsId: pcsIdArg }),
      listSellingPriceVersionsAction({ pcsId: pcsIdArg }),
      listListingPriceVersionsAction({ pcsId: pcsIdArg }),
    ]);
    setCounts({
      prime: p.success ? p.data.versions.length : 0,
      selling: s.success ? s.data.versions.length : 0,
      listing: l.success ? l.data.versions.length : 0,
    });
  };

  useEffect(() => {
    if (!open || !pcsId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchVersions(pcsId, activeTab)
      .then((rows) => {
        if (cancelled) return;
        setVersions(rows);
      })
      .catch((err) => {
        if (cancelled) return;
        setError((err as Error).message);
        setVersions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, pcsId, activeTab]);

  useEffect(() => {
    if (!open || !pcsId) return;
    void reloadCounts(pcsId);
  }, [open, pcsId]);

  if (!open || !pcsId) return null;

  const refresh = async () => {
    setLoading(true);
    try {
      const rows = await fetchVersions(pcsId, activeTab);
      setVersions(rows);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
    await reloadCounts(pcsId);
    onChanged?.();
  };

  const onDelete = async (v: UnifiedVersionRow) => {
    if (!confirm(t('delete.confirm', { date: v.effectiveFrom }))) return;
    setDeletingId(v.id);
    let res;
    if (activeTab === 'prime') {
      res = await softDeletePrimeCostVersionAction({ pcvId: v.id });
    } else if (activeTab === 'selling') {
      res = await softDeleteSellingPriceVersionAction({ spvId: v.id });
    } else {
      res = await softDeleteListingPriceVersionAction({ lpvId: v.id });
    }
    setDeletingId(null);
    if (!res.success) {
      setError(res.error.message);
      return;
    }
    await refresh();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4">
      <div className="w-full max-w-3xl rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-neutral-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">{t('history.title')}</h2>
            <p className="mt-0.5 text-sm text-neutral-500">
              <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">{skuLabel}</code>
              <span className="ml-2">{productName}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
            aria-label={tCommon('close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center border-b border-neutral-200 px-6">
          {(['prime', 'selling', 'listing'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                'border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                activeTab === tab
                  ? 'border-accent-700 text-accent-700'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700',
              )}
            >
              {t(`tab.${tab}`)}{' '}
              <span
                className={cn(
                  'ml-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px]',
                  activeTab === tab ? 'bg-accent-700/15 text-accent-700' : 'bg-neutral-100 text-neutral-500',
                )}
              >
                {counts[tab]}
              </span>
            </button>
          ))}
        </div>

        {/* Add-version banner */}
        <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50/60 px-6 py-3">
          <p className="text-xs text-neutral-500">{t('flag.disabledNotice')}</p>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-700/90"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('add')}
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-3 rounded-md border border-error-500 bg-error-50 px-3 py-2 text-sm text-error-500">
            {error}
          </div>
        )}

        {/* Versions table */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {loading && versions.length === 0 ? (
            <div className="py-6 text-center text-sm text-neutral-500">{tCommon('loading')}</div>
          ) : versions.length === 0 ? (
            <div className="py-6 text-center text-sm text-neutral-500">{t('history.empty')}</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-[11px] uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{t('effectiveFrom')}</th>
                  <th className="px-3 py-2 text-right font-medium">VND</th>
                  <th className="px-3 py-2 text-right font-medium">KRW</th>
                  <th className="px-3 py-2 text-left font-medium">{t('sourceNote')}</th>
                  <th className="px-3 py-2 text-left font-medium">{tCommon('createdAt')}</th>
                  <th className="px-3 py-2 text-right font-medium">{tCommon('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {versions.map((v, i) => {
                  const isLatest = i === 0;
                  return (
                    <tr key={v.id} className={cn(isLatest && 'bg-success-50/30')}>
                      <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                        {v.effectiveFrom}
                        {isLatest && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-success-500/15 px-1.5 py-0.5 text-[10px] font-medium text-success-500">
                            {t('history.latestBadge')}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-neutral-900">
                        {fmtVnd(v.valueVnd)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-neutral-500">
                        {fmtKrw(v.valueVnd)}
                      </td>
                      <td className="px-3 py-2 text-xs text-neutral-600">
                        {v.sourceNote ?? tCommon('dash')}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-neutral-500 whitespace-nowrap">
                        {fmtDateTime(v.createdAt)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => onDelete(v)}
                          disabled={deletingId === v.id || versions.length <= 1}
                          title={versions.length <= 1 ? t('delete.lastWarning') : undefined}
                          className="inline-flex items-center gap-1 rounded-md border border-error-500 bg-white px-2 py-1 text-xs font-medium text-error-500 hover:bg-error-50 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="h-3 w-3" />
                          {tCommon('delete')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add-version sub-modal */}
      {addOpen && (
        <AddVersionModal
          pcsId={pcsId}
          tab={activeTab}
          onClose={() => setAddOpen(false)}
          onSaved={async () => {
            setAddOpen(false);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

interface AddVersionModalProps {
  pcsId: string;
  tab: VersionTab;
  onClose: () => void;
  onSaved: () => void;
}

function AddVersionModal({ pcsId, tab, onClose, onSaved }: AddVersionModalProps) {
  const t = useTranslations('primeCost.version');
  const tCommon = useTranslations('common');
  const todayIso = new Date().toISOString().slice(0, 10);
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso);
  const [value, setValue] = useState('');
  // Prime-cost-only breakdown fields
  const [cogs, setCogs] = useState('');
  const [logistic, setLogistic] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [fulfillment, setFulfillment] = useState('');
  const [sourceNote, setSourceNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cost = Number(value.replace(/[, ]/g, ''));
    if (!Number.isFinite(cost) || cost < 0) {
      setError(t('error.primeCostInvalid'));
      return;
    }
    setSubmitting(true);
    let res;
    if (tab === 'prime') {
      const breakdown: Record<string, number | string> = {};
      if (cogs) breakdown.cogs = Number(cogs.replace(/[, ]/g, ''));
      if (logistic) breakdown.logistic = Number(logistic.replace(/[, ]/g, ''));
      if (warehouse) breakdown.warehousePerDay = Number(warehouse.replace(/[, ]/g, ''));
      if (fulfillment) breakdown.fulfillment = Number(fulfillment.replace(/[, ]/g, ''));
      res = await addPrimeCostVersionAction({
        pcsId,
        effectiveFrom,
        primeCostVnd: cost,
        breakdown: Object.keys(breakdown).length > 0 ? breakdown : null,
        sourceNote: sourceNote.trim() || null,
      });
    } else if (tab === 'selling') {
      res = await addSellingPriceVersionAction({
        pcsId,
        effectiveFrom,
        valueVnd: cost,
        sourceNote: sourceNote.trim() || null,
      });
    } else {
      res = await addListingPriceVersionAction({
        pcsId,
        effectiveFrom,
        valueVnd: cost,
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

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-900/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-neutral-900">
            {t('add')} — {t(`tab.${tab}`)}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
            aria-label={tCommon('close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 px-6 py-5">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-500">
              {t('effectiveFrom')} *
            </span>
            <input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              required
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
            />
            <span className="mt-1 block text-[11px] text-neutral-500">
              {t('effectiveFromDesc')}
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

          {/* Optional cost breakdown — Prime tab only */}
          {tab === 'prime' && (
            <details className="rounded-md border border-neutral-200 px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium text-neutral-700">
                {t('breakdown.title')}
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <BreakdownInput label={t('breakdown.cogs')} value={cogs} onChange={setCogs} />
                <BreakdownInput label={t('breakdown.logistic')} value={logistic} onChange={setLogistic} />
                <BreakdownInput label={t('breakdown.warehouse')} value={warehouse} onChange={setWarehouse} />
                <BreakdownInput label={t('breakdown.fulfillment')} value={fulfillment} onChange={setFulfillment} />
              </div>
            </details>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-500">
              {t('sourceNote')}
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
              disabled={submitting}
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

function BreakdownInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] text-neutral-500">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-right font-mono text-xs tabular-nums focus:border-neutral-500 focus:outline-none"
      />
    </label>
  );
}
