import type { ReactNode } from 'react';
import { cn } from '@car-v2/ui/cn';
import { Icon } from './icon';

type Props = {
  value?: string;
  placeholder?: string;
  prefix?: ReactNode;
  onClick?: () => void;
  className?: string;
};

/** Visual-only select (display + chev). Replace with headless-ui Listbox or RHF Combobox in P1+. */
export function Select({ value, placeholder, prefix, onClick, className }: Props) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 bg-white border border-neutral-150 rounded-lg px-3 h-[38px] text-[13.5px] cursor-pointer',
        value ? 'text-neutral-800' : 'text-neutral-400',
        className,
      )}
    >
      {prefix}
      <div className="flex-1 truncate">{value || placeholder}</div>
      <Icon name="chevd" size={14} color="#7e8799" />
    </div>
  );
}
