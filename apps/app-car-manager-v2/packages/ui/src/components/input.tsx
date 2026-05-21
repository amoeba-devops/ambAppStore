import { forwardRef } from 'react';
import { cn } from '../cn.js';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, iconLeft, iconRight, type = 'text', ...props }, ref) => {
    /* Mobile bumps height to 44px (touch target) and font to 16px to avoid
     * iOS Safari's auto-zoom when focusing inputs < 16px. */
    if (iconLeft || iconRight) {
      return (
        <div className={cn(
          'relative flex items-center rounded border bg-surface transition-colors',
          'has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring has-[input:focus-visible]:ring-offset-2 has-[input:focus-visible]:ring-offset-bg',
          error ? 'border-danger' : 'border-border has-[input:focus-visible]:border-accent',
          className,
        )}>
          {iconLeft && <span className="pl-3 text-text-faint shrink-0 flex items-center [&_svg]:h-4 [&_svg]:w-4">{iconLeft}</span>}
          <input
            ref={ref}
            type={type}
            className={cn(
              'flex-1 h-11 md:h-9 bg-transparent px-3 text-base md:text-sm placeholder:text-text-faint focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed',
              iconLeft && 'pl-2',
              iconRight && 'pr-2',
            )}
            {...props}
          />
          {iconRight && <span className="pr-3 text-text-faint shrink-0 flex items-center [&_svg]:h-4 [&_svg]:w-4">{iconRight}</span>}
        </div>
      );
    }
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'flex h-11 md:h-9 w-full rounded border bg-surface px-3 text-base md:text-sm',
          'placeholder:text-text-faint',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'file:bg-transparent file:border-0 file:text-sm file:font-medium',
          error ? 'border-danger focus-visible:border-danger' : 'border-border focus-visible:border-accent',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';
