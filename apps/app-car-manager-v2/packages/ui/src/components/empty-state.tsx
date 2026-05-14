import { forwardRef, type ReactNode } from 'react';
import { cn } from '../cn.js';

interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon, title, description, action, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-col items-center justify-center text-center py-12 px-6 mx-auto max-w-sm',
        className,
      )}
      {...props}
    >
      {icon && (
        <div className="h-12 w-12 rounded-full bg-accent-soft text-accent flex items-center justify-center mb-4 [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </div>
      )}
      <h3 className="text-md font-semibold text-text">{title}</h3>
      {description && <p className="mt-1.5 text-sm text-text-muted leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  ),
);
EmptyState.displayName = 'EmptyState';
