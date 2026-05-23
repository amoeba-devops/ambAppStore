'use client';
import { useEffect, useState, type CSSProperties } from 'react';
import { Toaster as SonnerToaster, toast } from 'sonner';

export function Toaster() {
  /* Position is responsive — mobile pins toasts to the bottom so the driver's
   * thumb-zone reaches them and they don't collide with the iPhone Dynamic
   * Island in PWA standalone. Desktop keeps the conventional top-right slot.
   *
   * Mobile offset must clear:
   *   - BottomTabNav (h-14 = 56px) AND
   *   - the elevated Dashboard button (STAFF only) which overflows ~20px above
   *     the nav top, plus
   *   - the iOS home-indicator safe-area inset.
   * Hence 84px above safe-area — the elevated button is at ~76px and we want
   * ~8px breathing room. Previously a flat 72px under-cleared the button on
   * STAFF mobile and toasts kissed the icon. */
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  /* `--width` is Sonner's documented CSS variable for toast width — set on
   * the wrapper so every toast inherits. On mobile we span the viewport
   * minus 16px gutters (room for the swipe-dismiss gesture); cap at 420px
   * for foldables / large phones so the toast doesn't grow ridiculously
   * wide. Desktop keeps the 356px Sonner default. */
  const mobileStyle = { '--width': 'min(calc(100vw - 1rem), 420px)' } as CSSProperties;

  return (
    <SonnerToaster
      position={isMobile ? 'bottom-center' : 'top-right'}
      offset={isMobile ? 'calc(84px + env(safe-area-inset-bottom, 0px))' : undefined}
      style={isMobile ? mobileStyle : undefined}
      richColors={false}
      /* Close button on mobile is a tiny 16px tap target sitting at the toast
       * corner — too easy to miss and competes with swipe-to-dismiss. Keep it
       * desktop-only; mobile relies on swipe + 4s auto-dismiss. */
      closeButton={!isMobile}
      /* 4s gives mobile users a beat longer to read in a glance scenario
       * (walking, one-handed). Desktop reads identically — 4s isn't long
       * enough to feel sticky there. */
      duration={4000}
      /* Stack 3 visible toasts on desktop / 2 on mobile so the queue doesn't
       * dominate the bottom of a small screen. */
      visibleToasts={isMobile ? 2 : 3}
      gap={isMobile ? 8 : 12}
      toastOptions={{
        unstyled: false,
        classNames: {
          /* Mobile bumps padding + font-size 1 notch for legibility under
           * outdoor light / one-handed glance. Desktop stays compact. */
          toast: [
            'group toast rounded-md border border-border bg-surface text-text shadow-pop',
            'md:px-4 md:py-3 md:text-sm',
            'px-4 py-3.5 text-[15px] leading-snug',
          ].join(' '),
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
