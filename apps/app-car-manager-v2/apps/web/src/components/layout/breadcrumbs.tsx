import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@car-v2/ui';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (!items.length) return null;
  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1 text-xs text-text-muted', className)}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="inline-flex items-center gap-1">
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                {item.label}
              </Link>
            ) : (
              <span className={cn(isLast && 'text-text font-medium')} aria-current={isLast ? 'page' : undefined}>
                {item.label}
              </span>
            )}
            {!isLast && <ChevronRight className="h-3 w-3 text-text-faint" aria-hidden />}
          </span>
        );
      })}
    </nav>
  );
}
