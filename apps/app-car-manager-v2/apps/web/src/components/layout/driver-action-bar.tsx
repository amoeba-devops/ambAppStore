import { cn } from '@car-v2/ui';

interface DriverActionBarProps {
  children: React.ReactNode;
  className?: string;
}

/* Sticky bottom action area for Driver primary CTAs (Accept / Reject / Start /
 * End trip, expense Submit). Lives ABOVE the global BottomTabNav (h-14 on
 * mobile) and at the page floor on desktop.
 *
 * Children should be ≤ 2 full-width Buttons with size="2xl" — the bar's whole
 * job is to put the next decision into the thumb zone and out of any
 * scroll-context that could hide it. Add extra `pb-32` on the page's main
 * scroll container so the last item isn't tucked behind the bar.
 *
 * SSR-safe: pure server component (no `'use client'`). */
export function DriverActionBar({ children, className }: DriverActionBarProps) {
  return (
    <div
      className={cn(
        'fixed left-0 right-0 z-30',
        /* Mobile: park above BottomTabNav (h-14) + iOS home-indicator safe area.
         * Desktop (md): tab bar is hidden, sit at viewport bottom. */
        'bottom-[calc(56px+env(safe-area-inset-bottom,0px))] md:bottom-0',
        /* Translucent surface so map / content peeks through but text reads. */
        'bg-bg/92 backdrop-blur-md border-t border-border',
        /* Pad bottom on desktop for safe-area too (iPadOS, externally-installed PWA). */
        'px-4 py-3 md:pb-3',
        'pb-[max(env(safe-area-inset-bottom),12px)] md:pb-3',
        /* Stack 1–2 children full-width on mobile; side-by-side on md+. */
        'flex flex-col md:flex-row gap-2 md:justify-end md:max-w-3xl md:mx-auto',
        '[&>*]:flex-1 md:[&>*]:flex-initial md:[&>*]:min-w-[160px]',
        className,
      )}
    >
      {children}
    </div>
  );
}
