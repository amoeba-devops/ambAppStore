import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';
import { cn } from '../cn.js';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full font-medium leading-none whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-2 text-text-muted ring-1 ring-inset ring-border',
        accent:  'bg-accent-soft text-accent ring-1 ring-inset ring-accent/20',
        info:    'bg-info-soft text-info ring-1 ring-inset ring-info/20',
        success: 'bg-success-soft text-success ring-1 ring-inset ring-success/20',
        warning: 'bg-warning-soft text-warning ring-1 ring-inset ring-warning/30',
        danger:  'bg-danger-soft text-danger ring-1 ring-inset ring-danger/20',
        purple:  'bg-purple-soft text-purple ring-1 ring-inset ring-purple/20',
        solid:   'bg-primary text-primary-fg',
      },
      size: {
        sm: 'h-5 px-2 text-xs',
        md: 'h-6 px-2.5 text-xs',
        lg: 'h-7 px-3 text-sm',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(({ className, tone, size, ...props }, ref) => (
  <span ref={ref} className={cn(badgeVariants({ tone, size }), className)} {...props} />
));
Badge.displayName = 'Badge';

export { badgeVariants };
