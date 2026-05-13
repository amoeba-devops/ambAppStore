import { forwardRef } from 'react';
import { cn } from '../cn.js';

type CardVariant = 'outline' | 'elevated' | 'ghost';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'outline', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-surface rounded-md',
        variant === 'outline' && 'border border-border',
        variant === 'elevated' && 'shadow-md border border-border/40',
        variant === 'ghost' && '',
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-5 py-4 flex items-center justify-between gap-3 border-b border-border', className)} {...props} />
  ),
);
CardHeader.displayName = 'CardHeader';

export const CardHeaderText = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('min-w-0 flex-1', className)} {...props} />,
);
CardHeaderText.displayName = 'CardHeaderText';

export const CardTitle = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-lg font-semibold text-text leading-tight', className)} {...props} />
  ),
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-text-muted mt-0.5', className)} {...props} />
  ),
);
CardDescription.displayName = 'CardDescription';

export const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { padded?: boolean }>(
  ({ className, padded = true, ...props }, ref) => (
    <div ref={ref} className={cn(padded && 'px-5 py-4', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

export const CardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-5 py-3 border-t border-border bg-surface-2/60 rounded-b-md', className)} {...props} />
  ),
);
CardFooter.displayName = 'CardFooter';
