import { getTranslations } from 'next-intl/server';
import { Mail } from 'lucide-react';
import { Avatar, Badge, Card, CardContent } from '@car-v2/ui';
import type { LocalRole } from '@car-v2/shared/auth';

interface MeProfileCardProps {
  name: string;
  email: string | null;
  role: LocalRole;
}

/* Profile summary card — visible to every role. Layout is intentionally
 * mobile-first (single column, avatar lg) since this lands on a phone for
 * drivers; the same layout reads fine on desktop without becoming sparse. */
export async function MeProfileCard({ name, email, role }: MeProfileCardProps) {
  const tMe = await getTranslations('settings.me');
  const tRoles = await getTranslations('settings.me.roles');

  return (
    <Card>
      <CardContent>
        <div className="flex items-start gap-4">
          <Avatar name={name} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-md font-semibold text-text truncate">{name}</h2>
              <Badge tone={ROLE_TONE[role]} size="sm">{tRoles(role)}</Badge>
            </div>
            {email && (
              <a
                href={`mailto:${email}`}
                className="mt-1 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-accent transition-colors truncate"
              >
                <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">{email}</span>
              </a>
            )}
            <div className="mt-2 text-xs text-text-faint">{tMe('profileHint')}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const ROLE_TONE: Record<LocalRole, 'accent' | 'info' | 'success'> = {
  ADMIN: 'accent',
  MANAGER: 'info',
  DRIVER: 'success',
};
