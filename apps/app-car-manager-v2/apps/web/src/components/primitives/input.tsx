import type { InputHTMLAttributes } from 'react';
import { cn } from '@car-v2/ui/cn';
import { Icon, type IconName } from './icon';

type Props = {
  icon?: IconName;
  suffix?: string;
  mono?: boolean;
  error?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>;

export function Input({ icon, suffix, mono, error, className, ...rest }: Props) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 bg-white border rounded-lg px-3 h-[38px] text-[13.5px]',
        error ? 'border-danger-500' : 'border-neutral-150',
        mono && 'font-mono',
        className,
      )}
    >
      {icon && <Icon name={icon} size={15} color="#7e8799" />}
      <input
        {...rest}
        className="flex-1 bg-transparent outline-none text-neutral-800 placeholder:text-neutral-400 min-w-0"
      />
      {suffix && <div className="text-neutral-400 text-[12px] flex-shrink-0">{suffix}</div>}
    </div>
  );
}
