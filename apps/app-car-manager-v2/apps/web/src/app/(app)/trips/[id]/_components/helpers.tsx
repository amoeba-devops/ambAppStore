import type { CarTripStatus } from '@car-v2/db/schema';

export const STATUS_TONE: Record<
  CarTripStatus,
  'accent' | 'warning' | 'success' | 'info' | 'neutral' | 'danger'
> = {
  PENDING_ASSIGNMENT:          'accent',
  PENDING_DRIVER_CONFIRMATION: 'warning',
  CONFIRMED:                   'success',
  IN_PROGRESS:                 'info',
  COMPLETED:                   'neutral',
  REJECTED_BY_DRIVER:          'danger',
  CANCELLED:                   'danger',
};

export function statusLongLabel(status: CarTripStatus, t: (k: string) => string): string {
  if (status === 'PENDING_DRIVER_CONFIRMATION') return t('PENDING_DRIVER_CONFIRMATION_LONG');
  if (status === 'REJECTED_BY_DRIVER') return t('REJECTED_BY_DRIVER_LONG');
  return t(status);
}

export function fmtDateTime(d: Date): string {
  return new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export function fmtShortDateTime(d: Date): string {
  return new Date(d).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
}

/** Section heading — small uppercase title used to label inline sections.
 *  Mirrors the visual rhythm of Linear ticket pages: short, dim, distant. */
export function SectionTitle({
  children,
  as: As = 'h2',
  className,
}: {
  children: React.ReactNode;
  as?: 'h2' | 'h3';
  className?: string;
}) {
  return (
    <As
      className={`text-[10.5px] font-bold text-text-faint uppercase tracking-wider mb-3 ${className ?? ''}`}
    >
      {children}
    </As>
  );
}

/** Compact property row: small uppercase label + bold value + optional sub. */
export function Property({
  icon,
  label,
  value,
  sub,
  mono,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-text-faint uppercase tracking-wider mb-1 [&_svg]:h-3 [&_svg]:w-3">
        {icon}
        <span>{label}</span>
      </div>
      <div
        className={`text-sm font-semibold text-text leading-snug ${mono ? 'font-mono tabular' : ''}`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-text-muted leading-tight">{sub}</div>}
    </div>
  );
}

/** Vertical pickup → dropoff timeline with connecting hairline.
 *  Dots have ring-4 ring-bg so the line visually passes BEHIND them. */
export function RouteTimeline({
  pickup,
  dropoff,
  stopoverCount,
  labels,
}: {
  pickup: string;
  dropoff: string;
  stopoverCount: number;
  labels: { pickup: string; dropoff: string; stopovers: string };
}) {
  return (
    <div className="relative">
      <div className="absolute left-[11px] top-3 bottom-3 w-px bg-border" aria-hidden />

      <div className="relative flex items-start gap-3.5 pb-5">
        <div className="h-[22px] w-[22px] rounded-full bg-accent flex items-center justify-center shrink-0 ring-4 ring-bg relative z-10">
          <div className="h-1.5 w-1.5 bg-bg rounded-full" />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="text-[10.5px] font-semibold text-text-faint uppercase tracking-wider">{labels.pickup}</div>
          <div className="text-sm font-semibold text-text mt-1 leading-snug break-words">{pickup}</div>
        </div>
      </div>

      {stopoverCount > 0 && (
        <div className="relative flex items-center gap-3.5 pb-5 -mt-1">
          <div className="w-[22px] flex justify-center shrink-0">
            <div className="h-1.5 w-1.5 rounded-full bg-text-muted/40" aria-hidden />
          </div>
          <span className="text-xs text-text-muted italic">{labels.stopovers}</span>
        </div>
      )}

      <div className="relative flex items-start gap-3.5">
        <div className="h-[22px] w-[22px] rounded-full bg-success flex items-center justify-center shrink-0 ring-4 ring-bg relative z-10">
          <div className="h-1.5 w-1.5 bg-bg rounded-full" />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="text-[10.5px] font-semibold text-text-faint uppercase tracking-wider">{labels.dropoff}</div>
          <div className="text-sm font-semibold text-text mt-1 leading-snug break-words">{dropoff}</div>
        </div>
      </div>
    </div>
  );
}

/** Horizontal workflow stepper — visualises the trip's position in the 5-step
 *  happy path (PENDING_ASSIGNMENT → PENDING_DRIVER_CONFIRMATION → CONFIRMED →
 *  IN_PROGRESS → COMPLETED). Branch states (REJECTED_BY_DRIVER, CANCELLED)
 *  render the linear stepper as inactive with a separate danger badge.
 *
 *  Why this matters: state machine is the core business object — Manager's
 *  primary task is "where is this trip in its lifecycle?". A stepper makes
 *  that scannable in <1 second vs. parsing the status name. */
const LINEAR_STEPS: CarTripStatus[] = [
  'PENDING_ASSIGNMENT',
  'PENDING_DRIVER_CONFIRMATION',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
];

export function WorkflowStepper({
  status,
  t,
}: {
  status: CarTripStatus;
  t: (k: string) => string;
}) {
  const isBranchState = status === 'REJECTED_BY_DRIVER' || status === 'CANCELLED';
  const currentIdx = LINEAR_STEPS.indexOf(status);

  return (
    <div className="w-full">
      <div className="relative flex items-center justify-between">
        <div
          className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-px bg-border"
          aria-hidden
        />
        {LINEAR_STEPS.map((step, i) => {
          const isPast = !isBranchState && i < currentIdx;
          const isCurrent = !isBranchState && i === currentIdx;
          const isFuture = isBranchState || i > currentIdx;
          return (
            <div key={step} className="relative z-10 flex flex-col items-center gap-2 bg-bg px-1.5">
              <div
                className={[
                  'h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold tabular border-2 transition-colors',
                  isCurrent &&
                    'bg-accent border-accent text-white ring-4 ring-accent-soft',
                  isPast && 'bg-success border-success text-white',
                  isFuture && 'bg-bg border-border text-text-faint',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isPast ? '✓' : i + 1}
              </div>
              <div
                className={[
                  'text-[10px] font-semibold text-center max-w-[80px] leading-tight',
                  isCurrent && 'text-text',
                  isPast && 'text-text-muted',
                  isFuture && 'text-text-faint',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {t(step)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
