'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ExternalLink, Loader2, Lock, Save, Unlock } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardHeaderText,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@car-v2/ui';
import type { CarUserLocalRole } from '@car-v2/db/schema';
import { updateMemberAction } from '@/server/actions/users/update-member.action';
import { formatActionError } from '@/lib/format-action-error';

interface EditMemberFormProps {
  userId: string;
  name: string | null;
  email: string | null;
  amaRoleSnapshot: string | null;
  localRole: CarUserLocalRole;
  blocked: boolean;
  isSelf: boolean;
}

const LOCAL_ROLES: CarUserLocalRole[] = ['ADMIN', 'MANAGER', 'DRIVER'];

const AMA_MEMBERS_URL =
  process.env.NEXT_PUBLIC_AMA_ORIGIN
    ? `${process.env.NEXT_PUBLIC_AMA_ORIGIN}/entity-settings/members`
    : null;

export function EditMemberForm({
  userId,
  name,
  email,
  amaRoleSnapshot,
  localRole: initialLocalRole,
  blocked: initialBlocked,
  isSelf,
}: EditMemberFormProps) {
  const router = useRouter();
  const t = useTranslations('users.edit');
  const tErr = useTranslations();
  const [pending, startTransition] = useTransition();
  const [localRole, setLocalRole] = useState<CarUserLocalRole>(initialLocalRole);
  const [blocked, setBlocked] = useState(initialBlocked);

  const dirty = localRole !== initialLocalRole || blocked !== initialBlocked;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    startTransition(async () => {
      const res = await updateMemberAction({
        userId,
        localRole: localRole !== initialLocalRole ? localRole : undefined,
        blocked: blocked !== initialBlocked ? blocked : undefined,
      });
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      toast.success(t('updatedToast', { name: name ?? email ?? userId }));
      router.push('/users');
      router.refresh();
    });
  };

  return (
    <Card variant="elevated">
      <CardHeader>
        <CardHeaderText>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeaderText>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
          {/* AMA-owned fields — read-only display + link to AMA UI to change */}
          <div className="rounded-md bg-surface-2 p-3 space-y-2 text-sm">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5 sm:gap-2">
              <span className="text-text-muted text-xs sm:text-sm">{t('name')}</span>
              <span className="font-medium text-text break-words">{name ?? '—'}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5 sm:gap-2">
              <span className="text-text-muted text-xs sm:text-sm">{t('emailIdLabel')}</span>
              <span className="font-mono text-xs text-text break-all">{email ?? '—'}</span>
            </div>
            {amaRoleSnapshot && (
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2">
                <span className="text-text-muted text-xs sm:text-sm">{t('amaRoleLabel')}</span>
                <Badge tone="neutral" size="sm">{amaRoleSnapshot}</Badge>
              </div>
            )}
            {AMA_MEMBERS_URL && (
              <div className="pt-1.5 border-t border-border text-xs text-text-muted leading-relaxed">
                {t('amaManagedHint')}{' '}
                <a
                  href={AMA_MEMBERS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent inline-flex items-center gap-1 hover:underline"
                >
                  {t('openOnAma')} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>

          {/* Local-only field — app role override */}
          <div>
            <Label htmlFor="localRole">
              {t('localRole')} <span className="text-danger">*</span>
            </Label>
            <Select value={localRole} onValueChange={(v) => setLocalRole(v as CarUserLocalRole)}>
              <SelectTrigger id="localRole">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCAL_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`localRoleOption.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-text-muted">{t('localRoleDesc')}</p>
          </div>

          {/* Local-only field — block from car-v2 (soft-delete) */}
          <div className="rounded-md border border-border p-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-text inline-flex items-center gap-1.5">
                  {blocked ? <Lock className="h-3.5 w-3.5 text-danger" /> : <Unlock className="h-3.5 w-3.5 text-success" />}
                  {blocked ? t('statusBlocked') : t('statusAllowed')}
                </div>
                <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                  {blocked ? t('blockedDesc') : t('allowedDesc')}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={blocked ? 'accent' : 'ghost'}
                className={blocked ? '' : 'text-danger hover:text-danger hover:bg-danger-soft'}
                disabled={isSelf || pending}
                onClick={() => setBlocked(!blocked)}
                iconLeft={blocked ? <Unlock /> : <Lock />}
              >
                {blocked ? t('toggleUnblock') : t('toggleBlock')}
              </Button>
            </div>
            {isSelf && (
              <p className="text-[11px] text-warning-strong">{t('blockSelfWarning')}</p>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => router.push('/users')}
              disabled={pending}
              className="w-full sm:w-auto"
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              variant="accent"
              size="lg"
              disabled={pending || !dirty}
              className="w-full sm:w-auto"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
