import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@car-v2/ui/cn';
import { Icon, type IconName } from './icon';

type Kind = 'primary' | 'solid' | 'ghost' | 'soft' | 'danger' | 'success' | 'link';
type Size = 'sm' | 'md' | 'lg';

type Props = {
  kind?: Kind;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  full?: boolean;
  children?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'>;

const sizeCls: Record<Size, string> = {
  sm: 'h-[30px] px-[10px] text-[12.5px] rounded-lg gap-1.5',
  md: 'h-9 px-[14px] text-[13px] rounded-lg gap-2',
  lg: 'h-11 px-[18px] text-[14px] rounded-[10px] gap-2',
};
const sizeIcon: Record<Size, number> = { sm: 14, md: 15, lg: 16 };
const kindCls: Record<Kind, string> = {
  primary: 'bg-brand-500 text-white border-brand-500 hover:bg-brand-600 hover:border-brand-600',
  solid:   'bg-neutral-800 text-white border-neutral-800 hover:bg-neutral-900',
  ghost:   'bg-white text-neutral-700 border-neutral-150 hover:bg-neutral-25',
  soft:    'bg-neutral-75 text-neutral-700 border-transparent hover:bg-neutral-100',
  danger:  'bg-danger-500 text-white border-danger-500 hover:bg-danger-600',
  success: 'bg-success-600 text-white border-success-600',
  link:    'bg-transparent text-brand-600 border-transparent hover:underline',
};

export function Btn({ kind = 'ghost', size = 'md', icon, iconRight, full, className, children, ...rest }: Props) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        'inline-flex items-center justify-center border font-semibold tracking-[-0.005em] whitespace-nowrap cursor-pointer transition-colors',
        sizeCls[size],
        kindCls[kind],
        full && 'w-full',
        className,
      )}
    >
      {icon && <Icon name={icon} size={sizeIcon[size]} />}
      {children}
      {iconRight && <Icon name={iconRight} size={sizeIcon[size]} />}
    </button>
  );
}
