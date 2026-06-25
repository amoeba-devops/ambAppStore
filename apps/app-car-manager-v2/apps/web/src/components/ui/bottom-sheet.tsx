'use client';

import { forwardRef, useRef, useState, type TouchEvent } from 'react';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  cn,
} from '@car-v2/ui';

/* `<BottomSheet>` is a thin mobile-first preset over `@car-v2/ui` Sheet.
 *
 * Why a wrapper:
 *   - Driver flows live almost entirely on phones — every dismissible surface
 *     should slide up from the bottom (thumb-reach), have a grab handle, and
 *     respect the iPhone home-indicator safe area.
 *   - The raw `<Sheet side="bottom">` from `@car-v2/ui` gets us 80% there but
 *     lacks the handle, max-height, bottom safe-area padding, and the native
 *     swipe-to-dismiss gesture users expect from an iOS/Android bottom sheet.
 *
 * Use this in place of `<Dialog>` for any driver-facing modal (reject reason,
 * cancel reason, expense quick-add, conflict acknowledgement). On desktop it
 * still slides up from the bottom — acceptable trade-off vs. shipping two
 * separate components per breakpoint. */

export const BottomSheet = Sheet;
export const BottomSheetTrigger = SheetTrigger;
export const BottomSheetClose = SheetClose;
export { SheetHeader as BottomSheetHeader };
export { SheetFooter as BottomSheetFooter };
export { SheetTitle as BottomSheetTitle };
export { SheetDescription as BottomSheetDescription };

interface BottomSheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetContent> {
  /* Hide the small grab handle if a sheet has no scroll content (rare). */
  hideHandle?: boolean;
}

/* Drag distance (px) past which the sheet snaps closed on touch release. */
const DRAG_CLOSE_THRESHOLD = 80;
/* Resistance applied to the visible drag distance so the sheet doesn't track
 * the finger 1:1 — gives a "rubbery" feel like iOS, signals that you're not
 * fully unbound from the dismiss action. */
const DRAG_RESISTANCE = 0.55;

export const BottomSheetContent = forwardRef<
  React.ElementRef<typeof SheetContent>,
  BottomSheetContentProps
>(({ className, children, hideHandle, ...props }, ref) => {
  /* Swipe-to-dismiss handled on the grab-handle only (not the entire body) so
   * a user scrolling a long form inside the sheet doesn't accidentally trigger
   * a close when they reach the top of the scroll container. The hidden
   * SheetClose ref is clicked to delegate the close to Radix Dialog, which
   * runs the existing slide-down animation + `onOpenChange` callback. */
  const closeRef = useRef<HTMLButtonElement>(null);
  const startY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  const onHandleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    startY.current = e.touches[0]?.clientY ?? null;
  };

  const onHandleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (startY.current === null) return;
    const y = e.touches[0]?.clientY ?? startY.current;
    const delta = y - startY.current;
    /* Only track downward drags — upward would scroll the sheet content. */
    if (delta > 0) setDragY(delta * DRAG_RESISTANCE);
  };

  const onHandleTouchEnd = () => {
    if (startY.current !== null && dragY > DRAG_CLOSE_THRESHOLD) {
      closeRef.current?.click();
    }
    startY.current = null;
    /* Reset transform — if the sheet is closing, Radix's exit animation
     * takes over and the residual transform isn't visible. */
    setDragY(0);
  };

  return (
    <SheetContent
      ref={ref}
      side="bottom"
      /* Don't auto-focus the first field on open. On mobile, focusing a text
       * input immediately raises the software keyboard, which slides up over
       * the bottom sheet and hides its content (e.g. the cancel/reject reason
       * box + confirm buttons). Keep focus on the (trapped) sheet so the user
       * sees the whole panel first and taps the field only when ready. Radix
       * still traps Tab + handles Esc. Placed before {...props} so a specific
       * sheet can opt back into auto-focus if it ever needs to. */
      onOpenAutoFocus={(e) => e.preventDefault()}
      className={cn(
        /* Cap height so a long form doesn't push the close button off-screen.
         * Internal scrolling on the body via overflow-y-auto. */
        'max-h-[88vh] overflow-y-auto',
        /* Pad the iPhone home indicator. Sheet base already has p-6 — bump bottom. */
        'pb-[max(env(safe-area-inset-bottom),24px)]',
        /* Stronger top-radius — mobile sheet aesthetic. */
        'rounded-t-2xl',
        className,
      )}
      style={
        dragY > 0
          ? { transform: `translateY(${dragY}px)`, transition: 'none' }
          : undefined
      }
      {...props}
    >
      {/* Hidden close button — programmatic target for swipe-to-dismiss. */}
      <SheetClose ref={closeRef} className="sr-only" tabIndex={-1} aria-hidden />

      {!hideHandle && (
        <div
          /* Wider tap zone than visible bar so the gesture is forgiving — the
           * actual grab pill is 40px wide but the parent button-styled div
           * catches touches across the full sheet width near the top. */
          role="button"
          tabIndex={-1}
          aria-label="Drag to dismiss"
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
          onTouchCancel={onHandleTouchEnd}
          className="-mt-3 mb-4 pt-1 pb-2 touch-none flex justify-center"
        >
          <div aria-hidden className="h-1.5 w-10 rounded-full bg-border" />
        </div>
      )}
      {children}
    </SheetContent>
  );
});
BottomSheetContent.displayName = 'BottomSheetContent';
