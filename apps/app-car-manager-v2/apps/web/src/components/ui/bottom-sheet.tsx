'use client';

import { forwardRef } from 'react';
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
 *     lacks the handle, max-height, and bottom safe-area padding.
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

export const BottomSheetContent = forwardRef<
  React.ElementRef<typeof SheetContent>,
  BottomSheetContentProps
>(({ className, children, hideHandle, ...props }, ref) => (
  <SheetContent
    ref={ref}
    side="bottom"
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
    {...props}
  >
    {!hideHandle && (
      <div
        aria-hidden
        className="mx-auto -mt-3 mb-4 h-1.5 w-10 rounded-full bg-border"
      />
    )}
    {children}
  </SheetContent>
));
BottomSheetContent.displayName = 'BottomSheetContent';
