'use client';

import { forwardRef } from 'react';
import { cn } from '@car-v2/ui';

interface AmountInputProps {
  value: number | null;
  onChange: (v: number | null) => void;
  id?: string;
  placeholder?: string;
  /* Currency suffix shown after the value. Defaults to "₫" (VND). */
  suffix?: string;
}

/* Numpad-optimised currency input.
 *
 * Why a custom component instead of `<Input type="number">`:
 *   - On Android/iOS, `type="number"` pops a small numeric keyboard but allows
 *     decimal separator characters that vary by locale; pasted strings with
 *     thousands separators get rejected silently. `inputMode="decimal"` opens
 *     the same numpad but on a `type="text"` field so we control parsing.
 *   - We want to display the formatted number with thousands separators while
 *     the underlying value is a plain `number`.
 *
 * Behavior:
 *   - User types digits only (any other character is stripped on input).
 *   - Display value is formatted with `vi-VN` grouping (1.250.000).
 *   - Trailing decimals are intentionally not supported — VND is whole-unit. */
export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(
  ({ value, onChange, id, placeholder = '0', suffix = '₫' }, ref) => {
    const display = value === null || value === 0 ? '' : value.toLocaleString('vi-VN');

    return (
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type="text"
          inputMode="decimal"
          pattern="[0-9]*"
          autoComplete="off"
          spellCheck={false}
          value={display}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^\d]/g, '');
            if (digits === '') {
              onChange(null);
              return;
            }
            /* JS Number safely handles up to 9 quadrillion — VND amounts won't
             * approach that, so plain Number is fine here. */
            onChange(Number(digits));
          }}
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
