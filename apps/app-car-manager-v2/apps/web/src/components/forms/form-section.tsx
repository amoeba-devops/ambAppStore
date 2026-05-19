import { cn, Label } from '@car-v2/ui';

/**
 * Flat form section with a tiny uppercase label + hairline divider.
 *
 * Replaces the Card+CardHeader pattern when vertical space matters: each
 * Card chrome (header + content padding + border) eats ~90px which adds up
 * fast in stacked forms. This helper drops the chrome entirely while still
 * giving the eye a clear group boundary.
 *
 * `min-w-0 overflow-x-hidden` is intentional and important: any descendant
 * that wants to be wider than the section (native datetime-local widgets,
 * long select option text, autocomplete dropdowns) gets clipped here
 * instead of escaping and triggering a page-level horizontal scrollbar.
 */
export function FormSection({
  label,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('min-w-0 overflow-x-hidden', className)}>
      <div className="flex items-baseline gap-2 mb-2 border-b border-border-faint pb-1">
        <h3 className="text-[10.5px] font-semibold uppercase tracking-wider text-text-faint">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </h3>
        {hint && <span className="text-[10.5px] text-text-faint">· {hint}</span>}
      </div>
      {children}
    </section>
  );
}

/**
 * Field row with label above the input. `inline` swaps to a compact 11px
 * label + tighter margin for dense forms.
 */
export function FormField({
  label,
  required,
  error,
  hint,
  className,
  inline,
  children,
}: {
  label: string;
  required?: boolean;
  error?: boolean;
  hint?: string;
  className?: string;
  /** Compact spacing for dense forms — smaller label, tighter margin. */
  inline?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label
        className={cn(
          inline ? 'mb-1 block text-xs' : 'mb-1.5 block',
          error && 'text-danger',
        )}
        required={required}
      >
        {label}
      </Label>
      {children}
      {hint && !error && <div className="text-xs text-text-faint mt-1">{hint}</div>}
    </div>
  );
}
