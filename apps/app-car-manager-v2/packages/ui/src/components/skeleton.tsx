import { cn } from '../cn.js';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse bg-surface-2 rounded', className)} {...props} />;
}
