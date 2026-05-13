import Link from 'next/link';
import { cn } from '@car-v2/ui';

interface FabProps {
  href: string;
  label: string;
  icon: React.ReactNode;
  /* Hide on desktop — the page header already has the primary action there. */
  mobileOnly?: boolean;
  className?: string;
}

/* Floating action button — mobile-first primary action. Positioned above the
 * BottomTabNav (h-14) with safe-area inset. Hidden on md+ by default. */
export function Fab({ href, label, icon, mobileOnly = true, className }: FabProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        'fixed right-4 z-30 bottom-[calc(56px+env(safe-area-inset-bottom,0px)+16px)]',
        'md:bottom-6 md:right-7',
        mobileOnly && 'md:hidden',
        'inline-flex items-center justify-center h-14 w-14 rounded-full',
        'bg-accent text-accent-fg shadow-lg',
        'hover:bg-accent/90 active:bg-accent/80 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        'transition-all duration-150 motion-reduce:transition-none',
        '[&_svg]:h-6 [&_svg]:w-6',
        className,
      )}
    >
      {icon}
    </Link>
  );
}
