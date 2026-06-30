'use client';

import { useEffect, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import type { FormulaParamSpec } from '@v2/shared';
import {
  listFormulaConfigVersionsAction,
  type FormulaConfigVersionRow,
} from '@/server/actions/formula-config.actions';

interface Props {
  spec: FormulaParamSpec;
  onClose: () => void;
}

/**
 * Slide-over drawer listing every persisted version for one formula param.
 * Read-only: shows each version's value, effective_from, source note + author.
 * Soft-deleted rows visually faded with a "deleted" badge so Admin can audit
 * the full timeline.
 */
export function FormulaParamHistoryDrawer({ spec, onClose }: Props) {
  const [rows, setRows] = useState<FormulaConfigVersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listFormulaConfigVersionsAction({ key: spec.key, limit: 50 }).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.success) {
        setError(res.error.message);
        return;
      }
      setRows(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [spec.key]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/30"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-lg flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-neutral-200 px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-neutral-900">{spec.displayName}</h3>
            <p className="mt-0.5 text-xs text-neutral-500">Version history · latest first</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && <p className="text-sm text-neutral-500">Loading…</p>}
          {error && (
            <div className="rounded-md border border-error-500 bg-error-50 px-3 py-2 text-sm text-error-500">
              {error}
            </div>
          )}
          {!loading && !error && rows.length === 0 && (
            <p className="text-sm text-neutral-500">No versions yet.</p>
          )}
          <ul className="space-y-2">
            {rows.map((r) => {
              const deleted = r.deletedAt != null;
              return (
                <li
                  key={r.ffcId}
                  className={
                    'rounded-md border px-3 py-2.5 text-sm ' +
                    (deleted
                      ? 'border-neutral-200 bg-neutral-50 opacity-60'
                      : 'border-neutral-200 bg-white')
                  }
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-base font-semibold text-neutral-900">
                      {r.value}
                      {spec.unit ?? ''}
                    </span>
                    <span className="text-xs text-neutral-500">
                      Effective {new Date(r.effectiveFrom).toISOString().slice(0, 10)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {r.entId ? `Per-entity · ${r.entId.slice(0, 8)}…` : 'Global default'}
                    {r.createdBy && ` · by ${r.createdBy.slice(0, 8)}…`}
                  </div>
                  {r.sourceNote && (
                    <p className="mt-1.5 text-xs italic text-neutral-700">{r.sourceNote}</p>
                  )}
                  {deleted && (
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-error-50 px-2 py-0.5 text-[10px] font-medium text-error-500">
                      <Trash2 className="h-2.5 w-2.5" />
                      Deleted {new Date(r.deletedAt as string).toISOString().slice(0, 10)}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
