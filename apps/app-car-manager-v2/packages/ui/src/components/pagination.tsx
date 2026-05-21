import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from '../cn.js';
import { Button } from './button.js';

interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
  /* Sibling pages displayed on each side of the current page (default 1). */
  siblings?: number;
}

function range(start: number, end: number) {
  const out: number[] = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

function buildItems(page: number, pageCount: number, siblings = 1): Array<number | 'ellipsis-left' | 'ellipsis-right'> {
  const total = pageCount;
  const left = Math.max(2, page - siblings);
  const right = Math.min(total - 1, page + siblings);
  const showLeftDots = left > 2;
  const showRightDots = right < total - 1;

  if (total <= 7) return range(1, total);

  const items: Array<number | 'ellipsis-left' | 'ellipsis-right'> = [1];
  if (showLeftDots) items.push('ellipsis-left');
  for (const p of range(left, right)) items.push(p);
  if (showRightDots) items.push('ellipsis-right');
  items.push(total);
  return items;
}

export function Pagination({ page, pageCount, onPageChange, className, siblings = 1 }: PaginationProps) {
  if (pageCount <= 1) return null;
  const items = buildItems(page, pageCount, siblings);
  return (
    <nav role="navigation" aria-label="pagination" className={cn('flex items-center gap-1', className)}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft />
      </Button>
      {items.map((it, i) => {
        if (it === 'ellipsis-left' || it === 'ellipsis-right') {
          return (
            <span key={`${it}-${i}`} className="flex h-9 w-9 items-center justify-center text-text-faint">
              <MoreHorizontal className="h-4 w-4" />
            </span>
          );
        }
        const active = it === page;
        return (
          <Button
            key={it}
            variant={active ? 'primary' : 'ghost'}
            size="icon"
            onClick={() => onPageChange(it)}
            aria-current={active ? 'page' : undefined}
          >
            {it}
          </Button>
        );
      })}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        disabled={page >= pageCount}
        aria-label="Next page"
      >
        <ChevronRight />
      </Button>
    </nav>
  );
}
