import { getTranslations, getLocale } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { ChevronRight, ExternalLink, IdCard, Lock } from 'lucide-react';
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
import { db } from '@car-v2/db/client';
import { carTenantSettings } from '@car-v2/db/schema';
import { DebouncedSearchInput } from '@/components/inputs/debounced-search';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listUsers, type UserListItem } from '@/server/queries/users.queries';
import { AMA_ROLES, type LocalRole } from '@car-v2/shared/auth';
import { ClickableCard, ClickableTableRow, StopRowClick } from '@/components/clickable-table-row';
import { DriverSigninToggle } from './_components/driver-signin-toggle';
import { SyncFromAmaButton } from './_components/sync-from-ama-button';
import { UserPeekDrawer } from './_components/user-peek-drawer';

const LOCAL_ROLE_TONE: Record<LocalRole, 'accent' | 'info' | 'neutral'> = {
  ADMIN: 'accent', MANAGER: 'info', DRIVER: 'neutral',
};

const AMA_MEMBERS_URL =
  process.env.NEXT_PUBLIC_AMA_ORIGIN
    ? `${process.env.NEXT_PUBLIC_AMA_ORIGIN}/entity-settings/members`
    : null;

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

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; peek?: string }>;
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

  /* Human-readable label for the verbatim AMA role (all 7 roles synced from
   * ambManagement). Falls back to the raw code for any role not yet localized. */
  const amaRoleLabel = (role: string | null): string => {
    if (!role) return '—';
    return (AMA_ROLES as readonly string[]).includes(role)
      ? tList(`amaRoleOption.${role}`)
      : role;
  };

  /* Reads from `car_users` local DB. After Option 1b, members appear here
   * lazily — only after their first login to car-v2 (`ensureCarUser` JIT
   * upserts). Admin can force-populate via the "Sync from AMA" button for
   * the case "I just invited someone on AMA and want to assign them as
   * driver before they log in for the first time". */
  let users: UserListItem[] = await listUsers(actor.entId);
  /* Peek target resolved from the full (pre-filter) list so the drawer opens
   * even when the row is hidden by the current search/page. */
  const peekUser = sp.peek ? users.find((u) => u.usrId === sp.peek) ?? null : null;
  const tenantSettings = await db.query.carTenantSettings.findFirst({
    where: eq(carTenantSettings.entId, actor.entId),
    columns: { tnsUsersSyncedAt: true },
  });
  const lastSyncedAt = tenantSettings?.tnsUsersSyncedAt ?? null;

  if (searchQ) {
    const needle = searchQ.toLowerCase();
    users = users.filter(
      (u) =>
        (u.usrName ?? '').toLowerCase().includes(needle) ||
        (u.usrEmail ?? '').toLowerCase().includes(needle) ||
        (u.usrAmaRoleSnapshot ?? '').toLowerCase().includes(needle),
    );
  }

  const blocked = users.filter((u) => u.blocked).length;
  const allowed = users.length - blocked;

  const totalUsers = users.length;
  const totalPages = Math.max(1, Math.ceil(totalUsers / USERS_PAGE_SIZE));
  const pagedUsers = users.slice((page - 1) * USERS_PAGE_SIZE, page * USERS_PAGE_SIZE);
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
            {actor.role === 'ADMIN' && <SyncFromAmaButton />}
            {actor.role === 'ADMIN' && AMA_MEMBERS_URL && (
              <Button asChild variant="ghost" size="md" iconLeft={<ExternalLink />}>
                <a href={AMA_MEMBERS_URL} target="_blank" rel="noreferrer">
                  {tList('manageOnAma')}
                </a>
              </Button>
            )}
            {actor.role === 'ADMIN' && (
              <Button asChild variant="secondary" size="md" iconLeft={<IdCard />}>
                <Link href="/drivers/new">{tList('createDriver')}</Link>
              </Button>
            )}
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
            <div className="flex items-center gap-3 text-xs md:text-sm text-text-muted flex-wrap">
              <span>{tList('statsAllowed', { allowed, blocked })}</span>
              {lastSyncedAt && (
                <span
                  className="text-text-faint"
                  title={new Date(lastSyncedAt).toLocaleString()}
                >
                  · {tList('syncedAgo', { time: formatRelativeTime(lastSyncedAt, tRel, locale) })}
                </span>
              )}
            </div>
          </div>
        </div>

        {pagedUsers.length === 0 ? (
          <Card variant="outline" className="p-8 text-center">
            <div className="text-text-muted text-sm space-y-2">
              <p>
                {searchQ
                  ? tList('notFound', { query: searchQ })
                  : tList('emptyMembers')}
              </p>
              {!searchQ && actor.role === 'ADMIN' && AMA_MEMBERS_URL && (
                <p className="text-xs">
                  {tList('emptyHint')}{' '}
                  <a
                    href={AMA_MEMBERS_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline inline-flex items-center gap-1"
                  >
                    {tList('manageOnAma')} <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              )}
            </div>
          </Card>
        ) : (
          <>
            {/* Mobile: card list */}
            <ul className="md:hidden space-y-2.5">
              {pagedUsers.map((u) => (
                <li key={u.usrId} className={'rounded-md border border-border bg-surface ' + (u.blocked ? 'opacity-60' : '')}>
                  <ClickableCard href={usersPeekHref(u.usrId, page, searchQ)} scroll={false} className="px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    <Avatar name={u.usrName ?? u.usrEmail ?? '?'} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-semibold text-text truncate block">
                            {u.usrName ?? u.usrEmail ?? u.usrId}
                          </span>
                          <div className="text-xs text-text-faint truncate">{u.usrEmail ?? '—'}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge tone={LOCAL_ROLE_TONE[u.usrLocalRole]} size="sm">{u.usrLocalRole}</Badge>
                          {u.blocked && (
                            <Badge tone="danger" size="sm">
                              <Lock className="h-3 w-3 mr-0.5" />
                              {tList('blockedBadge')}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-text-muted" title={u.usrAmaRoleSnapshot ?? undefined}>
                          {tList('amaPrefix')}{' '}
                          <span className="font-medium text-text">{amaRoleLabel(u.usrAmaRoleSnapshot)}</span>
                        </span>
                        <span className="text-text-faint">{formatRelativeTime(u.usrLastLoginAt, tRel, locale)}</span>
                      </div>
                      {actor.role === 'ADMIN' && u.usrLocalRole === 'DRIVER' && u.usrId !== actor.userId && (
                        <div className="mt-2 pt-2 border-t border-border flex justify-end">
                          <StopRowClick>
                            <DriverSigninToggle
                              amaUserId={u.usrId}
                              displayName={u.usrName ?? u.usrEmail ?? u.usrId}
                              blocked={u.blocked}
                              compact
                            />
                          </StopRowClick>
                        </div>
                      )}
                    </div>
                  </div>
                  </ClickableCard>
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
                    <TableHead className="w-[220px] text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedUsers.map((u) => {
                    const isAdmin = actor.role === 'ADMIN';
                    const cells = (
                      <>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar name={u.usrName ?? u.usrEmail ?? '?'} size="md" />
                            <div className="min-w-0">
                              <span className="font-medium text-text truncate block">
                                {u.usrName ?? u.usrEmail ?? u.usrId}
                              </span>
                              <div className="text-xs text-text-faint truncate">{u.usrEmail ?? '—'}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="inline-flex items-center gap-1.5">
                            <Badge tone={LOCAL_ROLE_TONE[u.usrLocalRole]} size="sm">{u.usrLocalRole}</Badge>
                            {u.blocked && (
                              <Badge tone="danger" size="sm">
                                <Lock className="h-3 w-3 mr-0.5" />
                                {tList('blockedBadge')}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-text-muted" title={u.usrAmaRoleSnapshot ?? undefined}>{amaRoleLabel(u.usrAmaRoleSnapshot)}</TableCell>
                        <TableCell className="text-text-muted">
                          {formatRelativeTime(u.usrLastLoginAt, tRel, locale)}
                        </TableCell>
                        <TableCell className="text-right">
                          {isAdmin && (
                            <div className="inline-flex items-center gap-1 justify-end">
                              {u.usrLocalRole === 'DRIVER' && u.usrId !== actor.userId && (
                                <StopRowClick>
                                  <DriverSigninToggle
                                    amaUserId={u.usrId}
                                    displayName={u.usrName ?? u.usrEmail ?? u.usrId}
                                    blocked={u.blocked}
                                    compact
                                  />
                                </StopRowClick>
                              )}
                              <ChevronRight className="inline-block h-4 w-4 text-text-faint" />
                            </div>
                          )}
                        </TableCell>
                      </>
                    );
                    return isAdmin ? (
                      <ClickableTableRow
                        key={u.usrId}
                        href={usersPeekHref(u.usrId, page, searchQ)}
                        scroll={false}
                        className={u.blocked ? 'opacity-60' : ''}
                      >
                        {cells}
                      </ClickableTableRow>
                    ) : (
                      <TableRow key={u.usrId} className={u.blocked ? 'opacity-60' : ''}>
                        {cells}
                      </TableRow>
                    );
                  })}
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

      {peekUser && (
        <UserPeekDrawer
          user={peekUser}
          lastActiveLabel={formatRelativeTime(peekUser.usrLastLoginAt, tRel, locale)}
          isAdmin={actor.role === 'ADMIN'}
          isSelf={peekUser.usrId === actor.userId}
        />
      )}
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

function usersPeekHref(userId: string, page: number, q: string | undefined): string {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (page > 1) params.set('page', String(page));
  params.set('peek', userId);
  return `/users?${params.toString()}`;
}
