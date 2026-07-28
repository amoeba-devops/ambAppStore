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
import type { CarUserLocalRole, CarVehicleType } from '@car-v2/db/schema';
import { updateMemberAction } from '@/server/actions/users/update-member.action';
import {
  grantFleetAccessAction,
  revokeFleetAccessAction,
} from '@/server/actions/fleet-access/fleet-access.actions';
import { formatActionError } from '@/lib/format-action-error';

interface EditMemberFormProps {
  userId: string;
  name: string | null;
  email: string | null;
  amaRoleSnapshot: string | null;
  localRole: CarUserLocalRole;
  /** Live CAR/TRUCK memberships. Empty = not assigned to either app. */
  depts: CarVehicleType[];
  blocked: boolean;
  isSelf: boolean;
}

const LOCAL_ROLES: CarUserLocalRole[] = ['ADMIN', 'MANAGER', 'DRIVER'];
const DEPTS: CarVehicleType[] = ['CAR', 'TRUCK'];

const sameSet = (a: CarVehicleType[], b: CarVehicleType[]): boolean =>
  a.length === b.length && a.every((x) => b.includes(x));

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
  depts: initialDepts,
  blocked: initialBlocked,
  isSelf,
}: EditMemberFormProps) {
  const router = useRouter();
  const t = useTranslations('users.edit');
  const tDept = useTranslations('screens.fleetAccess');
  const tErr = useTranslations();
  const [pending, startTransition] = useTransition();
  const [localRole, setLocalRole] = useState<CarUserLocalRole>(initialLocalRole);
  const [depts, setDepts] = useState<CarVehicleType[]>(initialDepts);
  const [blocked, setBlocked] = useState(initialBlocked);

  /* ADMIN reaches both fleets implicitly (resolveFleetAccess), so membership
   * rows carry no meaning for them — the controls go read-only rather than
   * letting an admin "revoke" access that would come straight back. */
  const deptsLocked = localRole === 'ADMIN';
  const singleDept = localRole === 'DRIVER';

  const dirty =
    localRole !== initialLocalRole ||
    blocked !== initialBlocked ||
    !sameSet(depts, initialDepts);

  const toggleDept = (d: CarVehicleType) => {
    if (deptsLocked) return;
    setDepts((prev) =>
      prev.includes(d)
        ? prev.filter((x) => x !== d)
        : /* A DRIVER belongs to exactly one department (grantFleetAccessAction
           * rejects a second), so picking one REPLACES rather than adds. */
          singleDept
          ? [d]
          : DEPTS.filter((x) => x === d || prev.includes(x)),
    );
  };

  const changeRole = (next: CarUserLocalRole) => {
    setLocalRole(next);
    /* Demoting to DRIVER with both departments selected would be rejected on
     * save — trim to the first so what is on screen is what can be applied. */
    if (next === 'DRIVER' && depts.length > 1) setDepts([depts[0]!]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    startTransition(async () => {
      /* Order matters, and it is not arbitrary:
       *   1. REVOKES first — frees the single-department slot, so a driver moving
       *      CAR→TRUCK doesn't hit "a driver can belong to only one department".
       *   2. Role + block next — a grant on a blocked (soft-deleted) user is
       *      rejected, so unblocking has to land before the grants.
       *   3. GRANTS last — validated against the FINAL role. */
      const toRevoke = deptsLocked ? [] : initialDepts.filter((d) => !depts.includes(d));
      const toGrant = deptsLocked ? [] : depts.filter((d) => !initialDepts.includes(d));

      for (const d of toRevoke) {
        const res = await revokeFleetAccessAction({ userId, vehicleType: d });
        if (!res.success) {
          toast.error(formatActionError(res.error, tErr));
          router.refresh(); // partial application — show what actually stuck
          return;
        }
      }

      if (localRole !== initialLocalRole || blocked !== initialBlocked) {
        const res = await updateMemberAction({
          userId,
          localRole: localRole !== initialLocalRole ? localRole : undefined,
          blocked: blocked !== initialBlocked ? blocked : undefined,
        });
        if (!res.success) {
          toast.error(formatActionError(res.error, tErr));
          router.refresh();
          return;
        }
      }

      for (const d of toGrant) {
        const res = await grantFleetAccessAction({ userId, vehicleType: d });
        if (!res.success) {
          toast.error(formatActionError(res.error, tErr));
          router.refresh();
          return;
        }
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
            <Select value={localRole} onValueChange={(v) => changeRole(v as CarUserLocalRole)}>
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

          {/* Local-only field — which app(s) this user belongs to.
            *
            * The app role above is ONE global value shared by both workspaces;
            * the department is the only thing that actually separates car from
            * truck. It used to be editable only at /settings/fleet-access, which
            * is hidden from the menu — so in practice nobody could set it. */}
          <div>
            <Label>{t('deptLabel')}</Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {DEPTS.map((d) => {
                const on = depts.includes(d);
                return (
                  <Button
                    key={d}
                    type="button"
                    size="md"
                    variant={on ? 'accent' : 'ghost'}
                    className={on ? '' : 'border border-border'}
                    disabled={deptsLocked || pending}
                    aria-pressed={on}
                    onClick={() => toggleDept(d)}
                  >
                    {tDept(`dept.${d}`)}
                  </Button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-text-muted leading-relaxed">
              {deptsLocked
                ? t('deptAdminHint')
                : singleDept
                  ? t('deptDescDriver')
                  : t('deptDescStaff')}
            </p>
            {!deptsLocked && depts.length === 0 && (
              <p className="mt-1 text-xs text-warning-strong">{t('deptNoneWarning')}</p>
            )}
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
