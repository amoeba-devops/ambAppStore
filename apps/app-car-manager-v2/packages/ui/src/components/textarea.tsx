import { forwardRef } from 'react';
import { cn } from '../cn.js';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[88px] md:min-h-[80px] w-full rounded border bg-surface px-3 py-2 text-base md:text-sm leading-relaxed transition-colors',
        'placeholder:text-text-faint',
        'focus-visible:outline-none',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        error ? 'border-danger focus-visible:border-danger' : 'border-border focus-visible:border-accent',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
