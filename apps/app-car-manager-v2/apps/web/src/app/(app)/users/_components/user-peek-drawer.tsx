'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Clock, Lock, PencilLine, Shield } from 'lucide-react';
import { Avatar, Badge, Button, cn } from '@car-v2/ui';
import { AMA_ROLES, type LocalRole } from '@car-v2/shared/auth';
import { Sheet, SheetCloseButton } from '@/components/layout/sheet';
import { DriverSigninToggle } from './driver-signin-toggle';

const ROLE_TONE: Record<LocalRole, 'accent' | 'info' | 'neutral'> = {
  ADMIN: 'accent',
  MANAGER: 'info',
  DRIVER: 'neutral',
};

interface UserPeekDrawerProps {
  user: {
    usrId: string;
    usrName: string | null;
    usrEmail: string | null;
    usrLocalRole: LocalRole;
    usrAmaRoleSnapshot: string | null;
    blocked: boolean;
  };
  /** Pre-formatted relative time (formatting lives on the server page). */
  lastActiveLabel: string;
  isAdmin: boolean;
  isSelf: boolean;
}

/**
 * Slide-over drawer for a user — opens when `?peek={userId}` is in the URL.
 * Mirrors the TripPeekDrawer pattern: server pre-fetches the row + passes it
 * in; closing strips `?peek` while preserving the list's `?q` / `?page`.
 *
 * Mobile-first: full-width on phones (Sheet default), footer actions are
 * full-width with large tap targets.
 */
export function UserPeekDrawer({ user, lastActiveLabel, isAdmin, isSelf }: UserPeekDrawerProps) {
  const t = useTranslations('users.peek');
  const tList = useTranslations('users.list');
  const tA = useTranslations('actions');

  /* Verbatim AMA role → localized label, with raw-code fallback. */
  const amaRoleLabel = (role: string | null): string => {
    if (!role) return '—';
    return (AMA_ROLES as readonly string[]).includes(role)
      ? tList(`amaRoleOption.${role}`)
      : role;
  };

  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const displayName = user.usrName ?? user.usrEmail ?? user.usrId;
  const basePath = pathname ?? '/users';
  const closeUrl = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('peek');
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const handleClose = (open: boolean) => {
    if (open) return;
    router.replace(closeUrl(), { scroll: false });
  };

  const showSigninToggle = isAdmin && user.usrLocalRole === 'DRIVER' && !isSelf;

  return (
    <Sheet
      open
      onOpenChange={handleClose}
      title={t('a11yTitle', { name: displayName })}
      description={t('a11yDescription')}
    >
      {/* Header — avatar + identity + role badges */}
      <header className="flex items-start justify-between gap-3 border-b border-border bg-bg px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={displayName} size="lg" />
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-text">{displayName}</div>
            <div className="truncate text-xs text-text-faint">{user.usrEmail ?? '—'}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge tone={ROLE_TONE[user.usrLocalRole]} size="sm">{user.usrLocalRole}</Badge>
              {user.blocked && (
                <Badge tone="danger" size="sm">
                  <Lock className="mr-0.5 h-3 w-3" />
                  {tList('blockedBadge')}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <SheetCloseButton label={t('close')} />
      </header>

      {/* Body — detail fields */}
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <Field icon={<Shield />} label={tList('thAppRole')} value={user.usrLocalRole} />
        <Field icon={<Shield />} label={tList('thAmaRole')} value={amaRoleLabel(user.usrAmaRoleSnapshot)} />
        <Field icon={<Clock />} label={tList('thLastActive')} value={lastActiveLabel} />
      </div>

      {/* Footer — mobile-first full-width actions */}
      {(showSigninToggle || isAdmin) && (
        <footer className="space-y-2.5 border-t border-border bg-bg px-5 py-3">
          {showSigninToggle && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5">
              <span className="text-sm text-text">{t('signinLabel')}</span>
              <DriverSigninToggle
                amaUserId={user.usrId}
                displayName={displayName}
                blocked={user.blocked}
                compact
              />
            </div>
          )}
          {isAdmin && (
            <Button asChild variant="accent" size="lg" className="w-full" iconLeft={<PencilLine />}>
              <Link href={`/users/${user.usrId}/edit`}>{tA('edit')}</Link>
            </Button>
          )}
        </footer>
      )}
    </Sheet>
  );
}

function Field({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-text-faint [&_svg]:h-4 [&_svg]:w-4" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">{label}</div>
        <div className={cn('text-text', mono && 'font-mono text-sm tabular')}>{value}</div>
      </div>
    </div>
  );
}
