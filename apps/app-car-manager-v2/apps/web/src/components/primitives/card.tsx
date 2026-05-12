import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@car-v2/ui/cn';

type Props = {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  padding?: number;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function Card({ title, subtitle, action, padding = 20, children, className, style }: Props) {
  const hasHeader = !!title || !!action;
  return (
    <div
      className={cn('bg-white border border-neutral-100 rounded-xl', className)}
      style={style}
    >
      {hasHeader && (
        <div
          className="flex items-start justify-between gap-3"
          style={{ padding: `${padding - 4}px ${padding}px ${padding - 12}px` }}
        >
          <div>
            {title && (
              <div className="text-[14.5px] font-bold tracking-[-0.01em] text-neutral-800">{title}</div>
            )}
            {subtitle && (
              <div className="text-[12.5px] text-neutral-500 mt-1">{subtitle}</div>
            )}
          </div>
          {action}
        </div>
      )}
      <div style={{ padding: title ? `4px ${padding}px ${padding}px` : padding }}>
        {children}
      </div>
    </div>
  );
}
