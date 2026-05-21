import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, type LucideIcon } from 'lucide-react';
import { forwardRef } from 'react';
import { cn } from '../cn.js';

const alertVariants = cva(
  'relative w-full rounded-md border px-4 py-3 text-sm flex items-start gap-3 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:mt-0.5',
  {
    variants: {
      variant: {
        info:    'border-info/30 bg-info-soft text-info [&_svg]:text-info',
        success: 'border-success/30 bg-success-soft text-success [&_svg]:text-success',
        warning: 'border-warning/40 bg-warning-soft text-warning [&_svg]:text-warning',
        danger:  'border-danger/30 bg-danger-soft text-danger [&_svg]:text-danger',
        neutral: 'border-border bg-surface-2 text-text [&_svg]:text-text-muted',
      },
    },
    defaultVariants: { variant: 'info' },
  },
);

const defaultIcon: Record<NonNullable<VariantProps<typeof alertVariants>['variant']>, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
  neutral: Info,
};

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  icon?: React.ReactNode | false;
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'info', icon, children, ...props }, ref) => {
    const Icon = icon === false ? null : icon ?? (() => {
      const C = defaultIcon[variant ?? 'info'];
      return <C />;
    })();
    return (
      <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
        {Icon}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    );
  },
);
Alert.displayName = 'Alert';

export const AlertTitle = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h4 ref={ref} className={cn('font-semibold leading-tight text-current', className)} {...props} />
  ),
);
AlertTitle.displayName = 'AlertTitle';

export const AlertDescription = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('mt-0.5 text-text-muted leading-relaxed', className)} {...props} />
  ),
);
AlertDescription.displayName = 'AlertDescription';
