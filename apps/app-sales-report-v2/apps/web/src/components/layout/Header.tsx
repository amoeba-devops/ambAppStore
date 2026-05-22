import { cn } from '@v2/ui';
import type { LocalRole } from '@v2/shared/auth';
import { LanguageSwitcher } from './LanguageSwitcher';

interface HeaderProps {
  title: string;
  subtitle?: string;
  user: {
    name?: string;
    email?: string;
    role: LocalRole;
    userId: string;
  };
  actions?: React.ReactNode;
}

const roleStyles: Record<LocalRole, string> = {
  OPERATOR: 'bg-info-50 text-info-500',
  MANAGER: 'bg-warning-50 text-warning-500',
  ADMIN: 'bg-accent-50 text-accent-700',
};

export function Header({ title, subtitle, user, actions }: HeaderProps) {
  const initial = (user.name ?? user.email ?? user.userId).charAt(0).toUpperCase();
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-6">
      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold text-neutral-900">{title}</h1>
        {subtitle && <p className="truncate text-xs text-neutral-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {actions}
        <LanguageSwitcher />
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'rounded px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider',
              roleStyles[user.role],
            )}
          >
            {user.role}
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800 text-xs font-semibold text-neutral-50">
            {initial}
          </div>
        </div>
      </div>
    </header>
  );
}
