import type { ReactNode } from 'react';
import { cn } from '@car-v2/ui/cn';

type Props = {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
};

export function Field({ label, hint, error, required, children, className }: Props) {
  return (
    <label className={cn('flex flex-col gap-1.5 min-w-0', className)}>
      <div className="text-[12px] font-semibold text-neutral-700">
        {label}
        {required && <span className="text-danger-500 ml-0.5">*</span>}
      </div>
      {children}
      {error ? (
        <div className="text-[11.5px] text-danger-600">{error}</div>
      ) : hint ? (
        <div className="text-[11.5px] text-neutral-400">{hint}</div>
      ) : null}
    </label>
  );
}
