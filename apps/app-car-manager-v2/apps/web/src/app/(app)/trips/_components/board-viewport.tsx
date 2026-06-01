'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@car-v2/ui';

/**
 * Pins its own height to "from my top edge down to the bottom of the usable
 * viewport" so a child board can fill the screen and scroll internally —
 * without the page itself ever scrolling.
 *
 * Why JS and not pure CSS: the app shell root is `min-h-dvh` (growable), so a
 * `flex-1 min-h-0` chain does NOT clamp to the viewport once the board's
 * intrinsic content exceeds the available space — the page grows instead. The
 * chrome above this region (breadcrumb header, optional push-prompt strip)
 * varies in height per route/state, so a `calc(100dvh - Npx)` would be a guess.
 * Measuring the live top offset is exact.
 *
 * The bottom limit honours any viewport-fixed bottom bar (the mobile tab nav)
 * so the last column's cards never hide behind it. A small gap keeps the board
 * off the very edge.
 */
const BOTTOM_GAP = 16;
const MD_BREAKPOINT = 768;

interface BoardViewportProps {
  children: ReactNode;
  className?: string;
  /** Only pin the height on md+ viewports; below the breakpoint the height is
   * left to flow naturally (used on detail pages where content sits below the
   * board on mobile and a pinned height would trap page scroll). */
  desktopOnly?: boolean;
}

export function BoardViewport({ children, className, desktopOnly = false }: BoardViewportProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const compute = () => {
      if (desktopOnly && window.innerWidth < MD_BREAKPOINT) {
        if (el.style.height) el.style.height = '';
        return;
      }
      const rectTop = el.getBoundingClientRect().top;
      /* Default bottom = viewport bottom. If a fixed bar is anchored there
       * (mobile BottomTabNav), stop above it. */
      let bottomLimit = window.innerHeight;
      document.querySelectorAll('nav').forEach((n) => {
        if (getComputedStyle(n).position !== 'fixed') return;
        const r = n.getBoundingClientRect();
        if (r.height > 0 && r.bottom >= window.innerHeight - 2 && r.top < bottomLimit) {
          bottomLimit = r.top;
        }
      });
      const h = Math.max(Math.round(bottomLimit - rectTop - BOTTOM_GAP), 220);
      const next = `${h}px`;
      if (el.style.height !== next) el.style.height = next;
    };

    compute();
    /* Recompute when chrome above us changes height (push strip toggles,
     * breadcrumb wraps) or the viewport resizes / rotates. */
    const ro = new ResizeObserver(compute);
    ro.observe(document.documentElement);
    window.addEventListener('resize', compute);
    window.addEventListener('orientationchange', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
      window.removeEventListener('orientationchange', compute);
    };
  }, [desktopOnly]);

  return (
    <div ref={ref} className={cn('min-h-0 min-w-0', className)}>
      {children}
    </div>
  );
}
