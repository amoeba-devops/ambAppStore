'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Calculator, AlertCircle } from 'lucide-react';
import { cn } from '@v2/ui';
import { fmtVND } from '@/lib/format';
import { updateManualInputs } from '@/lib/raw-archive-state';
import { updateSnapshotManualInputsAction } from '@/server/actions/ingest.actions';

interface Props {
  periodKey: string;
  periodLabel: string;
  initial: Record<string, number>;
  /** When provided, also syncs new values to the DB snapshot so Weekly/Monthly Report reload with updated numbers. */
  snapshotRef?: {
    granularity: 'WEEKLY' | 'MONTHLY';
    weekNum?: number;
    monthIdx?: number;
    year: number;
  };
  onClose: () => void;
}

/** Field grouping for nicer layout — mirrors Step 3 wizard structure. */
function groupOf(field: string): 'Total Platform' | 'Shopee' | 'TikTok' {
  if (field.startsWith('Total Affiliate Booking Fee') && !field.includes('—')) return 'Total Platform';
  if (field.includes('— Shopee')) return 'Shopee';
  if (field.includes('— TikTok')) return 'TikTok';
  // 7 TikTok Platform Fee components (no `—` suffix)
  return 'TikTok';
}

export function ManualInputEditModal({ periodKey, periodLabel, initial, snapshotRef, onClose }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(initial)) out[k] = String(v);
    return out;
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const fields = Object.keys(initial);
  const grouped = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const f of fields) {
      const g = groupOf(f);
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(f);
    }
    return Array.from(m.entries());
  }, [fields]);

  const isFilled = (v: string) => /^-?\d+(\.\d+)?$/.test(v.trim());
  const missing = fields.filter((f) => !isFilled(values[f] ?? ''));
  const changedFields = fields.filter(
    (f) => parseFloat(values[f] ?? '0') !== (initial[f] ?? 0),
  );
  const canSubmit = missing.length === 0;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const next: Record<string, number> = {};
    for (const f of fields) next[f] = parseFloat(values[f] ?? '0');
    // Local audit trail (activity log + persisted override)
    updateManualInputs(periodKey, initial, next);
    // Persist to the DB snapshot so Weekly/Monthly Report pick up the new
    // values on next load. Best-effort — local UI still updates if the
    // snapshot doesn't exist yet (period was never ingested).
    if (snapshotRef) {
      try {
        await updateSnapshotManualInputsAction({ ...snapshotRef, manualInputs: next });
      } catch (err) {
        console.error('[manual-input-edit] snapshot update failed:', err);
      }
    }
    setSubmitting(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 backdrop-blur-sm px-4 py-6 text-left"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-full rounded-xl bg-white shadow-2xl overflow-hidden flex flex-col text-left"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-3.5">
          <div className="flex items-start gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-info-50 shrink-0">
              <Calculator className="h-4 w-4 text-info-500" />
            </span>
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-neutral-500 leading-tight">
                Edit Manual Input
              </span>
              <h3 className="text-sm font-semibold text-neutral-900 font-mono leading-tight mt-0.5">
                Period {periodLabel}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700 shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {missing.length > 0 && (
            <div className="rounded-md border border-warning-500/30 bg-warning-500/10 px-3 py-2 text-xs text-warning-500 flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                {missing.length} field{missing.length !== 1 ? 's' : ''} missing — fill all to
                save.
              </span>
            </div>
          )}
          {grouped.map(([groupName, groupFields]) => (
            <div key={groupName} className="rounded-md border border-neutral-200 overflow-hidden">
              <div className="bg-neutral-50/60 px-3 py-1.5 border-b border-neutral-100 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                {groupName}
              </div>
              <ul className="divide-y divide-neutral-100">
                {groupFields.map((f) => {
                  const cur = values[f] ?? '';
                  const baseline = initial[f] ?? 0;
                  const changed = parseFloat(cur || '0') !== baseline;
                  const invalid = !isFilled(cur);
                  return (
                    <li
                      key={f}
                      className={cn(
                        'flex items-center justify-between gap-3 px-3 py-2',
                        changed && 'bg-info-50/30',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-neutral-700 truncate">{f}</div>
                        {changed && (
                          <div className="text-[10px] text-neutral-500 tabular-nums">
                            was {fmtVND(baseline)}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={cur}
                          onChange={(e) =>
                            setValues((s) => ({ ...s, [f]: e.target.value }))
                          }
                          className={cn(
                            'w-36 rounded-md border bg-white px-2 py-1 text-right font-mono text-xs tabular-nums text-neutral-900 focus:outline-none',
                            invalid
                              ? 'border-error-500'
                              : changed
                                ? 'border-info-500'
                                : 'border-neutral-300 focus:border-neutral-500',
                          )}
                        />
                        <span className="text-[10px] font-medium uppercase text-neutral-400">
                          VND
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-neutral-100 bg-neutral-50/40 px-5 py-3">
          <span className="text-[11px] text-neutral-500">
            {changedFields.length === 0
              ? 'No changes yet'
              : `${changedFields.length} field${changedFields.length !== 1 ? 's' : ''} changed`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit || submitting || changedFields.length === 0}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold text-white transition-colors',
                canSubmit && changedFields.length > 0 && !submitting
                  ? 'bg-info-500 hover:bg-info-500/90'
                  : 'bg-neutral-300 cursor-not-allowed',
              )}
            >
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
