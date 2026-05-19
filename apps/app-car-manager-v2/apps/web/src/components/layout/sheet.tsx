'use client';

import { type ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@car-v2/ui';

/**
 * Slide-over panel (right-anchored sheet) on top of @radix-ui/react-dialog.
 *
 * Why a separate component vs the existing Dialog (centered modal):
 *   - Different animation (translate-x vs scale)
 *   - Different sizing (fills viewport height, fixed/fluid width)
 *   - Mobile-friendly: full-screen on narrow viewports
 *
 * Built-ins from Radix: focus trap, Esc to close, click-outside to close,
 * ARIA modal semantics, body scroll-lock. No need to re-implement.
 */

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Sheet content (header/body/footer slots are caller's job — keeps it generic). */
  children: ReactNode;
  /** ARIA label (required by Radix for accessibility). */
  title: string;
  /** Optional description for screen readers. */
  description?: string;
  /**
   * Width of the panel on tablet/desktop. Mobile is always full-width.
   * Tailwind class — e.g. `md:max-w-[480px] lg:max-w-[560px]`.
   */
  widthClassName?: string;
  className?: string;
}

export function Sheet({
  open,
  onOpenChange,
  children,
  title,
  description,
  widthClassName = 'md:max-w-[480px] lg:max-w-[560px]',
  className,
}: SheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            /* Dimmed backdrop. radix sets data-state for open/closed → drives fade. */
            'fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          )}
        />
        <DialogPrimitive.Content
          aria-describedby={description ? undefined : ''}
          className={cn(
            /* Pinned to right, full viewport height. flex-col so header/body/footer
             * stack cleanly with the body scrolling. */
            'fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col bg-bg shadow-2xl',
            widthClassName,
            /* Slide animation from the right. Radix manages data-state attributes. */
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-right',
            'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right',
            'data-[state=open]:duration-200 data-[state=closed]:duration-150',
            'focus-visible:outline-none',
            className,
          )}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          {description && (
            <DialogPrimitive.Description className="sr-only">
              {description}
            </DialogPrimitive.Description>
          )}
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Close button that triggers Radix's close machinery. Use inside Sheet header. */
export function SheetCloseButton({ label }: { label: string }) {
  return (
    <DialogPrimitive.Close
      aria-label={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <X className="h-4 w-4" />
    </DialogPrimitive.Close>
  );
}
