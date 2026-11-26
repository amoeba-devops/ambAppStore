'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Input } from '@car-v2/ui';
import { formatDecimalRaw, parseDecimalText } from '@/lib/decimal-input';

/** Digits with vi-VN thousand separators; anything unparseable passes through. */
function withSeparators(raw: string): string {
  return raw.trim() !== '' && !Number.isNaN(Number(raw))
    ? Number(raw).toLocaleString('vi-VN')
    : raw;
}

const digitsOnly = (text: string) => text.replace(/[^\d]/g, '');

/**
 * Money input (Sheet-2 T11 / DR10): shows the amount with thousand separators
 * and a "₫" unit suffix while storing the raw digit string in form state.
 * `value` is the raw numeric string (digits only); `onChange` receives the raw
 * digits (separators stripped) so existing Number()/numF() parsing keeps working.
 *
 * `decimals > 0` (FIX-261126 OBS-1 — truck fuel đơn giá / lít): the value may
 * carry up to that many decimals. The field reads "21.350,5" (vi-VN: "."
 * thousands, "," decimal) and `value` / `onChange` use "21350.5". Typing "."
 * or "," starts the decimals; pasted "21350.5" / "21.350,5" both read right
 * (see lib/decimal-input). Default 0 = the integer-only behaviour above,
 * unchanged for every other money field.
 *
 * IME safety (BUG-260804): with a Vietnamese keyboard active every keystroke
 * arrives inside an open composition — the Windows Telex/VNI layouts hold one
 * because digits double as tone keys. Rewriting the node's value mid-composition
 * (which is what re-rendering `10000` as `10.000` does) desyncs the IME, and it
 * re-commits its whole buffer on the next keystroke: "10000" came out as
 * "110.000". So while a composition is open we mirror the field's own text back
 * as `value` — React then has nothing to write — and only reformat once the
 * composition closes.
 */
export function MoneyInput({
  value,
  onChange,
  placeholder,
  decimals = 0,
  unit = '₫',
}: {
  value: string;
  onChange: (raw: string) => void;
  placeholder?: string;
  /** Max digits after the decimal mark; 0 = whole numbers only. */
  decimals?: number;
  /** Suffix shown inside the field (default "₫"). */
  unit?: ReactNode;
}) {
  /* The field's verbatim text while an IME composition is open, else null.
   * Non-null means "show exactly this, don't format". */
  const [composing, setComposing] = useState<string | null>(null);
  /* Same flag, readable synchronously: `onChange` fires in its own event and
   * cannot wait for the compositionstart re-render. */
  const isComposing = useRef(false);
  /* Decimal mode reads a keystroke by diffing against the text shown before
   * it; a composition is diffed as one chunk against the text it started on. */
  const compositionBase = useRef('');

  const format = (raw: string) => (decimals > 0 ? formatDecimalRaw(raw) : withSeparators(raw));
  const display = composing ?? format(value);
  const toRaw = (text: string, prevText: string) =>
    decimals > 0 ? parseDecimalText(text, prevText, decimals) : digitsOnly(text);

  return (
    <Input
      type="text"
      inputMode={decimals > 0 ? 'decimal' : 'numeric'}
      value={display}
      onCompositionStart={(e) => {
        isComposing.current = true;
        compositionBase.current = e.currentTarget.value;
        setComposing(e.currentTarget.value);
      }}
      onChange={(e) => {
        const text = e.target.value;
        if (isComposing.current) setComposing(text);
        /* Form state stays live either way — only the display is held back. */
        onChange(toRaw(text, display));
      }}
      onCompositionEnd={(e) => {
        isComposing.current = false;
        /* Dropping the mirror hands the display back to the formatter, and
         * the digits the IME just committed are what get formatted. */
        setComposing(null);
        onChange(toRaw(e.currentTarget.value, compositionBase.current));
      }}
      placeholder={placeholder}
      iconRight={<span className="text-xs text-text-faint">{unit}</span>}
    />
  );
}
