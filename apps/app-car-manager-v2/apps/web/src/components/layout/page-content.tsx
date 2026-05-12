import type { ReactNode } from 'react';
import { cn } from '@car-v2/ui/cn';

/** Scrolling content area inside AppFrame. Default padding matches DashboardA. */
export function PageContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('h-full overflow-auto px-7 pt-6 pb-8', className)}>{children}</div>
  );
}
