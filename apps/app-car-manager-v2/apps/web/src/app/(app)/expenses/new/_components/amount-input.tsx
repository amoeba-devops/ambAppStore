'use client';

import { forwardRef, useImperativeHandle, useRef } from 'react';
import { useLocale } from 'next-intl';
import { cn } from '@car-v2/ui';

interface AmountInputProps {
  value: number | null;
  onChange: (v: number | null) => void;
  id?: string;
  placeholder?: string;
  /* Currency suffix shown after the value. Defaults to "₫" (VND). */
  suffix?: string;
  /* Hard ceiling — exceeding values get clamped silently. Default matches the
   * `numeric(14, 2)` precision of `car_expenses.exp_amount` minus the fractional
   * digits we don't expose: 10^12 - 1 = 999,999,999,999. */
  max?: number;
}

/* Numpad-optimised currency input with locale-aware thousands grouping.
 *
 * Why a custom component (not `<Input type="number">`):
 *   - On Android/iOS, `type="number"` pops a numpad but allows the locale's
 *     decimal separator, breaking paste of strings that use a different one.
 *   - We want to display the value with thousands separators while the
 *     underlying form state stays a plain `number`.
 *
 * Behaviour:
 *   - Always shows the value formatted by the active i18n locale
 *     (vi → 1.250.000, en/ko → 1,250,000).
 *   - User types digits only; pasted `1,000` / `1.000` / spaces are all
 *     stripped on every keystroke.
 *   - Caret position is preserved by counting digits to the left of the cursor:
 *     after re-format we place the cursor at the equivalent digit index in the
 *     new string. No jump-to-end when editing mid-number.
 *   - NO HTML5 `pattern` attribute. The displayed value contains the locale's
 *     separator character — a `pattern="[0-9]*"` would mark the input as
 *     `:invalid` and trigger the browser's native "please match the format
 *     requested" popup on submit. Validation belongs in the parent form.
 *   - `inputMode="numeric"` chooses the whole-number numpad (no `.` key) —
 *     correct for VND which has no fractional unit in the UI.
 */
export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(
  (
    { value, onChange, id, placeholder = '0', suffix = '₫', max = 999_999_999_999 },
    externalRef,
  ) => {
    const locale = useLocale();
    /* Map next-intl 2-letter locale → BCP-47 tag for toLocaleString. */
    const bcp47 = locale === 'ko' ? 'ko-KR' : locale === 'en' ? 'en-US' : 'vi-VN';

    const innerRef = useRef<HTMLInputElement | null>(null);
    /* Bridge the inner ref to whatever ref the caller forwarded. */
    useImperativeHandle(externalRef, () => innerRef.current as HTMLInputElement);

    const display = value === null || value === 0 ? '' : value.toLocaleString(bcp47);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputEl = innerRef.current;
      const raw = e.target.value;
      /* Anchor for caret restore: how many digits appear to the LEFT of where
       * the cursor sits in the just-typed raw string. */
      const cursorPos = inputEl?.selectionStart ?? raw.length;
      const digitsBeforeCursor = raw.slice(0, cursorPos).replace(/[^\d]/g, '').length;

      const stripped = raw.replace(/[^\d]/g, '');
      if (stripped === '') {
        onChange(null);
        return;
      }
      const parsed = Number(stripped);
      const next = Number.isFinite(parsed) ? Math.min(parsed, max) : 0;
      onChange(next);

      /* Wait one frame so React commits the re-formatted display string, then
       * set the caret to the position with `digitsBeforeCursor` digits to its
       * left in the NEW string. Locale separators may shift positions. */
      requestAnimationFrame(() => {
        const el = innerRef.current;
        if (!el) return;
        const formatted = next.toLocaleString(bcp47);
        let count = 0;
        let pos = 0;
        for (; pos < formatted.length; pos += 1) {
          if (/\d/.test(formatted[pos] ?? '')) count += 1;
          if (count >= digitsBeforeCursor) {
            pos += 1;
            break;
          }
        }
        /* Safari throws if the input lost focus between keystroke and rAF. */
        try {
          el.setSelectionRange(pos, pos);
        } catch {
          /* swallow */
        }
      });
    };

    return (
      <div className="relative">
        <input
          ref={innerRef}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          value={display}
          onChange={handleChange}
          placeholder={placeholder}
          className={cn(
            /* Bigger than standard inputs because amount is the form's hero
             * field — a driver scanning a fuel receipt should be able to
             * confirm the value at a glance. */
            'w-full h-14 px-4 pr-10 rounded-lg border border-border bg-surface',
            'text-2xl font-bold tabular text-text text-right',
            'placeholder:text-text-faint placeholder:font-medium',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
            'disabled:opacity-50',
          )}
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-md font-semibold text-text-muted">
          {suffix}
        </span>
      </div>
    );
  },
);
AmountInput.displayName = 'AmountInput';
