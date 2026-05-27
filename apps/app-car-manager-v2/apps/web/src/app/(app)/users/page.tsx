import { getTranslations, getLocale } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { IdCard } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@car-v2/ui';
import { DebouncedSearchInput } from '@/components/inputs/debounced-search';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listUsers } from '@/server/queries/users.queries';
import { getTenantSyncSummary } from '@/server/queries/tenant-onboarding.queries';
import type { LocalRole } from '@car-v2/shared/auth';
import { RefreshUsersButton } from './_components/refresh-button';
import { DriverSigninToggle } from './_components/driver-signin-toggle';

const LOCAL_ROLE_TONE: Record<LocalRole, 'accent' | 'info' | 'neutral'> = {
  ADMIN: 'accent', MANAGER: 'info', DRIVER: 'neutral',
};

type RelativeTimeT = (key: string, vars?: Record<string, string | number>) => string;

function formatRelativeTime(date: Date | null, t: RelativeTimeT, locale: string): string {
  if (!date) return t('never');
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return t('justNow');
  if (diffMin < 60) return t('minutesAgo', { n: diffMin });
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return t('hoursAgo', { n: diffHr });
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return t('daysAgo', { n: diffDay });
  const diffWk = Math.floor(diffDay / 7);
  if (diffWk < 4) return t('weeksAgo', { n: diffWk });
  return new Date(date).toLocaleDateString(localeToBcp47(locale));
}

function localeToBcp47(locale: string): string {
  if (locale === 'vi') return 'vi-VN';
  if (locale === 'ko') return 'ko-KR';
  return 'en-US';
}

function isActiveUser(lastLoginAt: Date | null): boolean {
  if (!lastLoginAt) return false;
  return (Date.now() - new Date(lastLoginAt).getTime()) / 86_400_000 < 30;
}

/** Row hiển thị — lấy từ car_users local sau onboarding sync. */
interface DisplayUser {
  amaUserId: string;
  name: string;
  email: string;
  amaRole: string;
  localRole: LocalRole;
  lastLoginAt: Date | null;
}

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

const USERS_PAGE_SIZE = 20;

export default async function UsersPage({ searchParams }: PageProps) {
  const actor = await getCurrentUser();
  if (actor.role === 'DRIVER') redirect('/today');

  const sp = await searchParams;
  const searchQ = sp.q?.trim() || undefined;
  const page = Math.max(1, Number(sp.page ?? 1));

  const t       = await getTranslations('screens.users');
  const tA      = await getTranslations('actions');
  const tNav    = await getTranslations('nav');
  const tCo     = await getTranslations('company');
  const tList   = await getTranslations('users.list');
  const tRel    = await getTranslations('users.relativeTime');
  const locale  = await getLocale();

  /* SOURCE: car_users local DB (đã populate qua onboarding sync hoặc Refresh button).
   * Status filter tab (active/inactive/suspended) đã bỏ ở Wave 2 — car_users không
   * mirror amb_users.usr_status. Sẽ thêm lại nếu cần ở wave sau (mirror cột status). */
  const v2Users = await listUsers(actor.entId);
  const syncSummary = await getTenantSyncSummary(actor.entId);

  let displayUsers: DisplayUser[] = v2Users.map((u) => ({
    amaUserId: u.usrId,
    name: u.usrName ?? u.usrEmail?.split('@')[0] ?? 'User',
    email: u.usrEmail ?? '—',
    amaRole: u.usrAmaRoleSnapshot ?? 'UNKNOWN',
    localRole: u.usrLocalRole,
    lastLoginAt: u.usrLastLoginAt,
  }));

  if (searchQ) {
    const needle = searchQ.toLowerCase();
    displayUsers = displayUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(needle) ||
        u.email.toLowerCase().includes(needle) ||
        u.amaRole.toLowerCase().includes(needle),
    );
  }

  const active = displayUsers.filter((u) => isActiveUser(u.lastLoginAt)).length;
  const inactive = displayUsers.length - active;

  const totalUsers = displayUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalUsers / USERS_PAGE_SIZE));
  const pagedUsers = displayUsers.slice((page - 1) * USERS_PAGE_SIZE, page * USERS_PAGE_SIZE);
  const showingFrom = totalUsers === 0 ? 0 : (page - 1) * USERS_PAGE_SIZE + 1;
  const showingTo = Math.min(totalUsers, page * USERS_PAGE_SIZE);

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('users') }]}
        actions={
          <>
            {/* Sync calls AMA `/entity-settings/members` được OwnEntityGuard
             * gate ở MASTER/ADMIN only (USER_LEVEL+MASTER policy). MANAGER bị
             * AMA reject 403 nên ẩn nút để tránh confusing toast error. */}
            {actor.role === 'ADMIN' && <RefreshUsersButton />}
            {actor.role === 'ADMIN' && (
              <Button asChild variant="secondary" size="md" iconLeft={<IdCard />}>
                <Link href="/drivers/new">{tList('createDriver')}</Link>
              </Button>
            )}
            {/* Invite-user button retired (REQ-20260525). New driver onboarding
             * flow: admin sends the ent_code via personal message (SMS/Zalo/Telegram),
             * driver enters ent_code + phone on /login self-service. See user guide
             * "Đăng nhập" for the messaging template. The empty-state CTA still
             * points to /users/new for admins who really need the legacy form. */}
          </>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <DebouncedSearchInput
              placeholder={tList('searchPlaceholder')}
              className="md:w-80"
              clearLabel={tA('clear')}
            />
            <div className="flex items-center gap-3 text-xs md:text-sm text-text-muted">
              <span>{tList('statsActive', { active, inactive })}</span>
              {syncSummary.syncedAt && (
                <span
                  className="text-text-faint"
                  title={new Date(syncSummary.syncedAt).toLocaleString()}
                >
                  · {tList('syncedAgo', { time: formatRelativeTime(syncSummary.syncedAt, tRel, locale) })}
                </span>
              )}
            </div>
          </div>
        </div>

        {pagedUsers.length === 0 ? (
          <Card variant="outline" className="p-8 text-center">
            <div className="text-text-muted text-sm">
              {searchQ
                ? tList('notFound', { query: searchQ })
                : tList('emptyMembers')}
              {!searchQ && actor.role === 'ADMIN' && (
                <>
                  {' '}<Link href="/users/new" className="text-accent hover:underline">{tList('addNew')}</Link>.
                </>
              )}
            </div>
          </Card>
        ) : (
          <>
            {/* Mobile: card list */}
            <ul className="md:hidden space-y-2.5">
              {pagedUsers.map((u) => (
                <li key={u.amaUserId} className="rounded-md border border-border bg-surface px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    <Avatar name={u.name} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-semibold text-text truncate block">{u.name}</span>
                          <div className="text-xs text-text-faint truncate">{u.email}</div>
                        </div>
                        <Badge tone={LOCAL_ROLE_TONE[u.localRole]} size="sm">{u.localRole}</Badge>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-text-muted">
                          {tList('amaPrefix')}{' '}
                          <span className="font-mono">{u.amaRole}</span>
                        </span>
                        <span className="text-text-faint">{formatRelativeTime(u.lastLoginAt, tRel, locale)}</span>
                      </div>
                      {actor.role === 'ADMIN' && u.localRole === 'DRIVER' && (
                        <div className="mt-2 pt-2 border-t border-border flex justify-end">
                          <DriverSigninToggle
                            amaUserId={u.amaUserId}
                            displayName={u.name}
                            currentStatus="ACTIVE"
                            compact
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <Card variant="outline" className="hidden md:block overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tList('thUser')}</TableHead>
                    <TableHead>{tList('thAppRole')}</TableHead>
                    <TableHead>{tList('thAmaRole')}</TableHead>
                    <TableHead>{tList('thLastActive')}</TableHead>
                    <TableHead className="w-[200px] text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedUsers.map((u) => (
                    <TableRow key={u.amaUserId}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} size="md" />
                          <div className="min-w-0">
                            <span className="font-medium text-text truncate block">{u.name}</span>
                            <div className="text-xs text-text-faint truncate">{u.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge tone={LOCAL_ROLE_TONE[u.localRole]} size="sm">{u.localRole}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-text-muted">{u.amaRole}</TableCell>
                      <TableCell className="text-text-muted">
                        {formatRelativeTime(u.lastLoginAt, tRel, locale)}
                      </TableCell>
                      <TableCell className="text-right">
                        {actor.role === 'ADMIN' ? (
                          <div className="inline-flex items-center gap-1 justify-end">
                            {u.localRole === 'DRIVER' && (
                              <DriverSigninToggle
                                amaUserId={u.amaUserId}
                                displayName={u.name}
                                currentStatus="ACTIVE"
                                compact
                              />
                            )}
                            <Button asChild variant="ghost" size="sm">
                              <Link href={`/users/${u.amaUserId}/edit`}>{tA('edit')}</Link>
                            </Button>
                          </div>
                        ) : !isActiveUser(u.lastLoginAt) ? (
                          <span className="text-xs text-text-faint italic">{tList('inactive')}</span>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {totalPages > 1 && (
              <div className="flex flex-col-reverse md:flex-row md:items-center md:justify-between gap-3 text-sm text-text-muted">
                <span className="text-xs md:text-sm">
                  {tList('showing')}{' '}
                  <span className="font-semibold text-text tabular">{showingFrom}–{showingTo}</span>{' '}
                  {tList('of')}{' '}
                  <span className="font-semibold text-text tabular">{totalUsers}</span>
                </span>
                <div className="inline-flex items-center gap-1 self-end md:self-auto">
                  {page > 1 ? (
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={usersPageHref(page - 1, searchQ)}>{tList('previous')}</Link>
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" disabled>{tList('previous')}</Button>
                  )}
                  <span className="px-3 text-sm tabular">{page} / {totalPages}</span>
                  {page < totalPages ? (
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={usersPageHref(page + 1, searchQ)}>{tList('next')}</Link>
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" disabled>{tList('next')}</Button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function usersPageHref(page: number, q: string | undefined): string {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `/users?${qs}` : '/users';
}
