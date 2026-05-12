import { cn } from '@car-v2/ui/cn';

type Kind = 'success' | 'warn' | 'danger' | 'info' | 'purple' | 'neutral' | 'teal';

const palette: Record<Kind, { bg: string; fg: string; dot: string }> = {
  success: { bg: 'bg-success-50',  fg: 'text-success-700', dot: 'bg-success-500' },
  warn:    { bg: 'bg-warning-50',  fg: 'text-warning-700', dot: 'bg-warning-500' },
  danger:  { bg: 'bg-danger-50',   fg: 'text-danger-700',  dot: 'bg-danger-500' },
  info:    { bg: 'bg-brand-50',    fg: 'text-brand-700',   dot: 'bg-brand-500' },
  purple:  { bg: 'bg-purple-50',   fg: 'text-purple-700',  dot: 'bg-purple-500' },
  neutral: { bg: 'bg-neutral-75',  fg: 'text-neutral-700', dot: 'bg-neutral-400' },
  teal:    { bg: 'bg-teal-50',     fg: 'text-teal-700',    dot: 'bg-teal-500' },
};

type Props = {
  kind: Kind;
  label: string;
  dense?: boolean;
  dot?: boolean;
};

export function StatusPill({ kind, label, dense = false, dot = true }: Props) {
  const c = palette[kind];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap border',
        c.bg,
        c.fg,
        `border-transparent`,
        dense ? 'px-2 py-[2px] text-[11.5px]' : 'px-2.5 py-[3px] text-[12px]',
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />}
      {label}
    </span>
  );
}
