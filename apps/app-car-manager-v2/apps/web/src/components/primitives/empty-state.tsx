import type { ReactNode } from 'react';
import { Icon, type IconName } from './icon';

type Tone = 'neutral' | 'info' | 'warn' | 'success';

const toneCls: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: 'bg-neutral-75', fg: 'text-neutral-500' },
  info: { bg: 'bg-brand-50', fg: 'text-brand-600' },
  warn: { bg: 'bg-warning-50', fg: 'text-warning-600' },
  success: { bg: 'bg-success-50', fg: 'text-success-600' },
};

type Props = {
  icon?: IconName;
  tone?: Tone;
  title: string;
  body?: string;
  action?: ReactNode;
};

export function EmptyState({ icon = 'inbox', tone = 'neutral', title, body, action }: Props) {
  const c = toneCls[tone];
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${c.bg} ${c.fg}`}>
        <Icon name={icon} size={22} />
      </div>
      <div className="mt-4 text-[15px] font-bold text-neutral-800">{title}</div>
      {body && <div className="mt-1 text-[13px] text-neutral-500 max-w-md">{body}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
