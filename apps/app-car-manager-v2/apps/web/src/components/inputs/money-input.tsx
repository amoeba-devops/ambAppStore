'use client';

import { Input } from '@car-v2/ui';

/**
 * Money input (Sheet-2 T11 / DR10): shows the amount with thousand separators
 * and a "₫" unit suffix while storing the raw digit string in form state.
 * `value` is the raw numeric string (digits only); `onChange` receives the raw
 * digits (separators stripped) so existing Number()/numF() parsing keeps working.
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
  const display =
    value.trim() !== '' && !Number.isNaN(Number(value))
      ? Number(value).toLocaleString('vi-VN')
      : value;
  return (
    <Input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
      placeholder={placeholder}
      iconRight={<span className="text-xs text-text-faint">₫</span>}
    />
  );
}
