import type { ReactNode } from 'react';

type Phase = 'P0' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6';

const phaseColor: Record<Phase, { bg: string; fg: string; label: string }> = {
  P0: { bg: 'bg-success-50', fg: 'text-success-700', label: 'P0 · Foundation (ready)' },
  P1: { bg: 'bg-brand-50',   fg: 'text-brand-700',   label: 'P1 · Trip MVP' },
  P2: { bg: 'bg-purple-50',  fg: 'text-purple-700',  label: 'P2 · Expense MVP' },
  P3: { bg: 'bg-teal-50',    fg: 'text-teal-700',    label: 'P3 · Reports + Dashboard' },
  P4: { bg: 'bg-warning-50', fg: 'text-warning-700', label: 'P4 · Maintenance + Notify' },
  P5: { bg: 'bg-purple-50',  fg: 'text-purple-700',  label: 'P5 · Mobile PWA' },
  P6: { bg: 'bg-neutral-75', fg: 'text-neutral-600', label: 'P6 · Hardening' },
};

type Props = {
  phase: Phase;
  /** Visual skeleton placeholder area — feel of the page when done */
  skeleton?: ReactNode;
  /** Description: 1 short sentence about what this screen will do */
  description?: string;
};

/**
 * Phase placeholder marker — used in every screen still pending implementation.
 * Visual shows "Coming in PhaseN" badge + skeleton hint + optional description.
 * Replace with real content when phase is implemented.
 */
export function PhaseGate({ phase, skeleton, description }: Props) {
  const c = phaseColor[phase];
  return (
    <div className="flex flex-col h-full">
      <div className={`inline-flex items-center gap-2 self-start px-3 py-1 rounded-full text-[11.5px] font-bold ${c.bg} ${c.fg}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
        {c.label}
      </div>
      {description && (
        <p className="mt-3 text-[13.5px] text-neutral-600 max-w-2xl leading-relaxed">{description}</p>
      )}
      {skeleton && <div className="mt-5 flex-1 min-h-0">{skeleton}</div>}
    </div>
  );
}
