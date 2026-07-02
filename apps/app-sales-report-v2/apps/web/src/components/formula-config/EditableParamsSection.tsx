'use client';

import { useCallback, useEffect, useState } from 'react';
import { Sliders } from 'lucide-react';
import {
  FORMULA_PARAM_REGISTRY,
  type FormulaConfigSnapshot,
} from '@v2/shared';
import { loadFormulaConfigAction } from '@/server/actions/formula-config.actions';
import { FormulaParamRow } from './FormulaParamRow';

interface Props {
  canEdit: boolean;
}

/**
 * Top-of-page section that lists every server-backed editable param from the
 * registry. Fetches the active snapshot via `loadFormulaConfigAction` and
 * renders one `FormulaParamRow` per registry entry. Refreshes after any
 * successful save so the new value + effective_from are visible immediately.
 *
 * Per Phase 1 of REQ-20260630 the registry has a single entry
 * (`tiktok_platform_fee_rate_pct`); Phase 2 adds more — the UI auto-renders
 * them without any per-key code change.
 */
export function EditableParamsSection({ canEdit }: Props) {
  const [snapshot, setSnapshot] = useState<FormulaConfigSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await loadFormulaConfigAction();
    if (!res.success) {
      setError(res.error.message);
      return;
    }
    setError(null);
    setSnapshot(res.data);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const specs = Object.values(FORMULA_PARAM_REGISTRY);

  return (
    <section className="rounded-lg border border-info-500/30 bg-info-50/30 p-4">
      <div className="mb-3 flex items-start gap-2">
        <Sliders className="mt-0.5 h-4 w-4 shrink-0 text-info-500" />
        <div>
          <h2 className="text-sm font-semibold text-info-500">Live formula parameters</h2>
          <p className="mt-0.5 text-xs text-neutral-700">
            Edits here persist to <code className="rounded bg-info-100 px-1 py-0.5 font-mono text-[10px]">sal_formula_configs</code>{' '}
            and apply to the next ingest. Existing snapshots stay frozen at their
            captured values — re-rendering a finalized report uses the rate
            active at that time.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-error-500 bg-error-50 px-3 py-2 text-sm text-error-500">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {specs.map((spec) => {
          const entry = snapshot?.[spec.key];
          if (!entry) {
            // Snapshot still loading → render placeholder
            return (
              <div
                key={spec.key}
                className="h-24 animate-pulse rounded-lg border border-neutral-200 bg-white"
              />
            );
          }
          return (
            <FormulaParamRow
              key={spec.key}
              spec={spec}
              currentValue={entry.value}
              effectiveFrom={entry.effectiveFrom}
              canEdit={canEdit}
              onSaved={refresh}
            />
          );
        })}
      </div>
    </section>
  );
}
