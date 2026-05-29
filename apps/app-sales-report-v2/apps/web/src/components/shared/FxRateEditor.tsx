'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  /** Currently active rate (effective: override if set, else DB default). */
  rate: number;
  /** Override value, or null when using DB default. Currently unused in UI
   *  (we no longer show a reset button), but kept in the API so callers
   *  don't need to change — and so we can re-introduce a reset affordance
   *  later if requested. */
  override: number | null;
  /** Set/clear the override. */
  onSet: (value: number | null) => void;
}

/**
 * Always-visible inline editor for the VND-per-KRW rate. Reused across RFR
 * Data pages (Product List, Prime/Selling/Listing Price) and Report pages
 * (Weekly, Monthly) so the rate field looks identical and shares state via
 * `useFxRateOverride` (localStorage + custom event).
 *
 * - Edits are committed on blur or Enter — not on every keystroke, so the
 *   table doesn't churn while user is typing decimals.
 * - i18n labels reuse the `weeklyReport.krwRate.*` namespace since this
 *   component originated in the report UI and the keys are already
 *   translated for all locales.
 */
export function FxRateEditor({ rate, override: _override, onSet }: Props) {
  const t = useTranslations('weeklyReport');
  const [draft, setDraft] = useState(rate.toFixed(3));

  // Keep draft in sync when rate changes from elsewhere (cross-page sync,
  // reset, etc.) — but ONLY when the input isn't focused, so we don't yank
  // text from under the user mid-type.
  useEffect(() => {
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    const inputs = document.querySelectorAll('input[data-fx-rate-editor]');
    const focused = Array.from(inputs).some((el) => el === active);
    if (!focused) setDraft(rate.toFixed(3));
  }, [rate]);

  const commit = () => {
    const parsed = Number(draft.replace(/[,\s]/g, ''));
    if (Number.isFinite(parsed) && parsed > 0) {
      // Only set override if the value actually differs from current rate.
      // Otherwise it's a no-op edit (user clicked away without changing).
      if (parsed !== rate) onSet(parsed);
    } else {
      // Reject invalid → snap back.
      setDraft(rate.toFixed(3));
    }
  };

  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm">
      <span className="text-neutral-500">{t('krwRate.prefix')}</span>
      <input
        data-fx-rate-editor
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          }
          if (e.key === 'Escape') {
            setDraft(rate.toFixed(3));
            e.currentTarget.blur();
          }
        }}
        className="w-24 rounded border border-neutral-200 px-2 py-0.5 text-right font-mono tabular-nums text-neutral-900 focus:border-neutral-500 focus:outline-none"
      />
      <span className="text-neutral-500">{t('krwRate.suffix')}</span>
    </div>
  );
}
