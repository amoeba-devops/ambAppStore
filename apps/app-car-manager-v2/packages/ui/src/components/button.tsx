import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from '@radix-ui/react-slot';
import { Loader2 } from 'lucide-react';
import { forwardRef } from 'react';
import { cn } from '../cn.js';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded font-medium ' +
    'transition-colors duration-150 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg ' +
    'disabled:pointer-events-none disabled:opacity-50 ' +
    'motion-reduce:transition-none ' +
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:   'bg-primary text-primary-fg hover:bg-primary/90 active:bg-primary/80',
        accent:    'bg-accent text-accent-fg hover:bg-accent/90 active:bg-accent/80',
        secondary: 'bg-surface text-text border border-border hover:bg-surface-2 active:bg-surface-2/80',
        ghost:     'text-text hover:bg-surface-2',
        danger:    'bg-danger text-white hover:bg-danger/90 active:bg-danger/80',
        link:      'text-accent underline-offset-4 hover:underline px-0 h-auto',
      },
      size: {
        sm:   'h-8 px-3 text-sm [&_svg]:h-3.5 [&_svg]:w-3.5',
        md:   'h-9 px-4 text-sm [&_svg]:h-4 [&_svg]:w-4',
        lg:   'h-10 px-5 text-md [&_svg]:h-4 [&_svg]:w-4',
        xl:   'h-11 px-6 text-md [&_svg]:h-5 [&_svg]:w-5',
        /* `2xl` is the Driver-mode primary CTA size — 56px tall so it lands
         * within the thumb zone on phones and remains tappable through a
         * sunlight-readability margin. Don't use elsewhere; it's loud.
         *
         * Visual treatment is intentionally heavier than smaller sizes — bigger
         * radius (12px instead of 6px), tracked-wide bold label, a soft lifted
         * shadow that compresses on press, and a subtle scale on active. This
         * matches the iOS "filled prominent" CTA shape so the button reads as
         * a mobile primary action even when sitting inside a desktop chrome.
         * Shadow tint is neutral slate so the same treatment works across
         * variants (accent/primary/danger) without colour clashes. */
        '2xl':
          'h-14 px-6 text-md font-bold tracking-wide rounded-xl ' +
          'shadow-[0_6px_16px_-4px_rgba(15,23,42,0.18)] ' +
          'active:scale-[0.98] active:shadow-[0_2px_6px_-2px_rgba(15,23,42,0.14)] ' +
          'transition-[transform,box-shadow,background-color] duration-150 motion-reduce:transition-none ' +
          'disabled:shadow-none disabled:active:scale-100 ' +
          '[&_svg]:h-5 [&_svg]:w-5',
        icon: 'h-9 w-9 [&_svg]:h-4 [&_svg]:w-4',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, iconLeft, iconRight, children, disabled, ...props }, ref) => {
    if (asChild) {
      /* Radix Slot requires exactly one React child. The caller is responsible
       * for placing any iconLeft/iconRight inside their own element. */
      return (
        <Slot ref={ref as React.Ref<HTMLElement>} className={cn(buttonVariants({ variant, size }), className)} {...props}>
          {children}
        </Slot>
      );
    }
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {loading ? <Loader2 className="animate-spin" aria-hidden /> : iconLeft}
        {children}
        {!loading && iconRight}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
