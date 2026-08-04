'use client';

import { useRef, useState } from 'react';
import { Input } from '@car-v2/ui';

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
}: {
  value: string;
  onChange: (raw: string) => void;
  placeholder?: string;
}) {
  /* The field's verbatim text while an IME composition is open, else null.
   * Non-null means "show exactly this, don't format". */
  const [composing, setComposing] = useState<string | null>(null);
  /* Same flag, readable synchronously: `onChange` fires in its own event and
   * cannot wait for the compositionstart re-render. */
  const isComposing = useRef(false);

  const display = composing ?? withSeparators(value);

  return (
    <Input
      type="text"
      inputMode="numeric"
      value={display}
      onCompositionStart={(e) => {
        isComposing.current = true;
        setComposing(e.currentTarget.value);
      }}
      onChange={(e) => {
        const text = e.target.value;
        if (isComposing.current) setComposing(text);
        /* Form state stays live either way — only the display is held back. */
        onChange(digitsOnly(text));
      }}
      onCompositionEnd={(e) => {
        isComposing.current = false;
        /* Dropping the mirror hands the display back to `withSeparators`, and
         * the digits the IME just committed are what get formatted. */
        setComposing(null);
        onChange(digitsOnly(e.currentTarget.value));
      }}
      placeholder={placeholder}
      iconRight={<span className="text-xs text-text-faint">₫</span>}
    />
  );
}
