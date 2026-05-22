'use client';

import { useEffect, useState } from 'react';

interface NumberInputProps {
  /** Raw numeric string without thousands separators (e.g. "1234567" or "12.5"). */
  value: string;
  /** Always receives the raw unformatted numeric string. Empty string when cleared. */
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  min?: number;
  step?: 'any' | number;
  invalid?: boolean;
  required?: boolean;
  'aria-label'?: string;
}

const SEPARATOR = ',';

/** Insert thousands separators into a non-negative numeric string. Preserves
 *  a trailing `.` and decimal digits so users can keep typing fractional
 *  values. Non-digit input (apart from a single `.`) is stripped. */
function format(raw: string): string {
  if (raw === '' || raw === '-') return raw;
  const isNeg = raw.startsWith('-');
  const cleaned = (isNeg ? raw.slice(1) : raw).replace(/[^\d.]/g, '');
  // Collapse multiple dots — keep the first one.
  const firstDot = cleaned.indexOf('.');
  const noExtraDots =
    firstDot === -1 ? cleaned : cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
  const [intPart, decPart] = noExtraDots.split('.');
  const intFormatted = (intPart ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, SEPARATOR);
  const out = decPart !== undefined ? `${intFormatted}.${decPart}` : intFormatted;
  return isNeg ? `-${out}` : out;
}

function unformat(display: string): string {
  return display.replace(new RegExp(`\\${SEPARATOR}`, 'g'), '');
}

/**
 * Numeric input that visually formats with thousands-separator commas while
 * always emitting the raw, unformatted numeric string upstream. The consumer
 * stores e.g. `"1234567"` and never has to strip commas before parseFloat.
 */
export function NumberInput({
  value,
  onChange,
  placeholder = '0',
  className,
  min,
  step,
  invalid,
  required,
  'aria-label': ariaLabel,
}: NumberInputProps) {
  // Mirror the formatted version so the input renders commas as the user types.
  // Internally we still treat empty as ''.
  const [display, setDisplay] = useState<string>(format(value));

  // Keep display in sync if the parent resets / mutates `value` externally
  // (e.g. modal opens with prefilled data).
  useEffect(() => {
    const next = format(value);
    setDisplay((cur) => (unformat(cur) === unformat(next) ? cur : next));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={display}
      onChange={(e) => {
        const raw = unformat(e.target.value);
        const reformatted = format(raw);
        setDisplay(reformatted);
        onChange(raw);
      }}
      placeholder={placeholder}
      min={min}
      step={step as React.InputHTMLAttributes<HTMLInputElement>['step']}
      required={required}
      aria-invalid={invalid || undefined}
      aria-label={ariaLabel}
      className={className}
    />
  );
}
