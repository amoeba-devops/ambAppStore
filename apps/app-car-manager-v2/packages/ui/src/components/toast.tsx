'use client';
import { useEffect, useState } from 'react';
import { Toaster as SonnerToaster, toast } from 'sonner';

export function Toaster() {
  /* Toast position is responsive — on mobile we want it at the bottom so the
   * driver's eyes / thumb don't have to travel to the top-right corner (which
   * also collides with the iPhone Dynamic Island in PWA standalone). Desktop
   * keeps the conventional top-right slot. The `offset` clears BottomTabNav
   * (h-14) + iOS home-indicator safe area so toasts don't sit on top of the
   * nav bar. */
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <SonnerToaster
      position={isMobile ? 'bottom-center' : 'top-right'}
      offset={isMobile ? 'calc(72px + env(safe-area-inset-bottom, 0px))' : undefined}
      richColors={false}
      closeButton
      duration={3500}
      toastOptions={{
        unstyled: false,
        classNames: {
          toast: 'group toast rounded-md border border-border bg-surface text-text shadow-pop px-4 py-3 text-sm',
          title: 'font-semibold',
          description: 'text-text-muted',
          actionButton: 'bg-accent text-accent-fg rounded px-2.5 py-1 text-xs font-medium',
          cancelButton: 'bg-surface-2 text-text rounded px-2.5 py-1 text-xs',
          success: '[&>div[data-icon]]:text-success',
          error:   '[&>div[data-icon]]:text-danger',
          warning: '[&>div[data-icon]]:text-warning',
          info:    '[&>div[data-icon]]:text-info',
        },
      }}
    />
  );
}

export { toast };
