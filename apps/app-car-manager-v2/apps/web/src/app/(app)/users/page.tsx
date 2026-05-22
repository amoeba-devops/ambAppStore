import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { IdCard, Plus } from 'lucide-react';
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
import { getCarUsersByAmaId, listUsers } from '@/server/queries/users.queries';
import { listEntityMembersFromAma } from '@/server/services/ama/list-entity-members';
import { mapAmaRoleToLocal, type AmaJwtClaims, type LocalRole } from '@car-v2/shared/auth';
import { RefreshUsersButton } from './_components/refresh-button';
import { DriverSigninToggle } from './_components/driver-signin-toggle';

const LOCAL_ROLE_TONE: Record<LocalRole, 'accent' | 'info' | 'neutral'> = {
  ADMIN: 'accent', MANAGER: 'info', DRIVER: 'neutral',
};

function formatRelativeTime(date: Date | null): string {
  if (!date) return 'Chưa từng đăng nhập';
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} giờ trước`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} ngày trước`;
  const diffWk = Math.floor(diffDay / 7);
  if (diffWk < 4) return `${diffWk} tuần trước`;
  return new Date(date).toLocaleDateString('vi-VN');
}

function isActiveUser(lastLoginAt: Date | null): boolean {
  if (!lastLoginAt) return false;
  return (Date.now() - new Date(lastLoginAt).getTime()) / 86_400_000 < 30;
}

/** Merged row: real AMA data + v2 cross-ref (nếu user đã login v2). */
interface DisplayUser {
  amaUserId: string;
  name: string;
  email: string;
  /** SĐT đăng nhập (canonical 10-digit từ AMA). Null khi user chưa được set phone. */
  phone: string | null;
  amaRole: string;          // raw từ AMA (usr_role: SUPER_ADMIN/ADMIN/MANAGER/MEMBER/...)
  localRole: LocalRole | null;  // null nếu chưa login v2
  lastLoginAt: Date | null;
  status: string;            // amb_users.usr_status: ACTIVE/PENDING/...
  source: 'ama+v2' | 'ama-only';
  /** ADMIN_LEVEL users không edit được từ entity context (cross-entity managed). */
  isCrossEntity: boolean;
}

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
}

const USERS_PAGE_SIZE = 20;
type StatusFilter = 'all' | 'active' | 'inactive' | 'suspended';
/* Tab order: "Tất cả" đầu tiên + default — admin landing page nên thấy mọi
 * user (kể cả bị khoá / đình chỉ) để dễ quản lý. */
const STATUS_FILTERS: StatusFilter[] = ['all', 'active', 'inactive', 'suspended'];

export default async function UsersPage({ searchParams }: PageProps) {
  const actor = await getCurrentUser();
  if (actor.role === 'DRIVER') redirect('/today');

  const sp = await searchParams;
  const searchQ = sp.q?.trim() || undefined;
  const page = Math.max(1, Number(sp.page ?? 1));
  const statusFilter = (STATUS_FILTERS.includes(sp.status as StatusFilter)
    ? sp.status
    : 'all') as StatusFilter;

  const t       = await getTranslations('screens.users');
  const tA      = await getTranslations('actions');
  const tNav    = await getTranslations('nav');
  const tCo     = await getTranslations('company');
  const tList   = await getTranslations('users.list');

  // PRIMARY source: AMA. Fallback to v2 car_users only nếu AMA unreachable.
  const amaMembers = await listEntityMembersFromAma(actor.entId);

  /* Status counts từ raw AMA list (trước filter) để render tab counter — admin
   * cần biết có bao nhiêu user INACTIVE/SUSPENDED ngay cả khi đang ở tab khác. */
  const statusCounts: Record<StatusFilter, number> = {
    active: amaMembers?.filter((m) => m.status === 'ACTIVE').length ?? 0,
    inactive: amaMembers?.filter((m) => m.status === 'INACTIVE').length ?? 0,
    suspended: amaMembers?.filter((m) => m.status === 'SUSPENDED').length ?? 0,
    all: amaMembers?.length ?? 0,
  };

  let displayUsers: DisplayUser[];

  if (amaMembers !== null) {
    // Cross-ref với car_users để lấy last_login + v2 local role
    const amaIds = amaMembers.map((m) => m.userId);
    const v2Map = await getCarUsersByAmaId(actor.entId, amaIds);

    /* Trước đây filter `status === 'ACTIVE'` cứng → user bị revoke biến mất, admin
     * không un-revoke được. Giờ áp dụng filter theo tab (default 'active' giữ
     * UX cũ cho normal use), nhưng admin có thể đổi tab xem INACTIVE/SUSPENDED. */
    displayUsers = amaMembers
      .filter((m) => {
        if (statusFilter === 'all') return true;
        return m.status === statusFilter.toUpperCase();
      })
      .map((m) => {
        const v2 = v2Map.get(m.userId);
        const localRole: LocalRole | null = v2?.usrLocalRole ?? safeMapRole(m.amaRole);
        return {
          amaUserId: m.userId,
          name: m.name ?? m.email.split('@')[0] ?? 'User',
          email: m.email,
          phone: m.phone,
          amaRole: m.amaRole,
          localRole,
          lastLoginAt: v2?.usrLastLoginAt ?? null,
          status: m.status,
          source: v2 ? ('ama+v2' as const) : ('ama-only' as const),
          // ADMIN_LEVEL = system admin assigned cross-entity → usr_company_id ≠ current entId
          // → AMA updateMember sẽ trả "Member not found in this entity"
          isCrossEntity: m.levelCode === 'ADMIN_LEVEL',
        };
      });
  } else {
    // Fallback: v2 cache only (MANAGER không có quyền call AMA, hoặc AMA down)
    const v2Users = await listUsers(actor.entId);
    displayUsers = v2Users.map((u) => ({
      amaUserId: u.usrId,  // dùng v2 usr_id làm key vì không có ama_user_id ở đây
      name: u.usrName ?? u.usrEmail?.split('@')[0] ?? 'User',
      email: u.usrEmail ?? '—',
      phone: null,  // car_users không mirror phone — chỉ AMA có nguồn
      amaRole: u.usrAmaRoleSnapshot ?? 'UNKNOWN',
      localRole: u.usrLocalRole,
      lastLoginAt: u.usrLastLoginAt,
      status: 'ACTIVE',
      source: 'ama+v2' as const,
      isCrossEntity: false,  // v2 cache only chứa user đã login với entity hiện tại
    }));
  }

  /* Client-side filter ngay trên list đã merge — data nhỏ (~10s-100s members
   * mỗi tenant) nên không cần đẩy filter xuống AMA/DB. Khớp tên / email /
   * SĐT / AMA role (case-insensitive). Phone match dùng raw needle để admin
   * có thể gõ partial như "0904" hoặc full số. */
  if (searchQ) {
    const needle = searchQ.toLowerCase();
    const phoneNeedle = searchQ.replace(/\D/g, '');
    displayUsers = displayUsers.filter(
      (u) =>
        (u.name && u.name.toLowerCase().includes(needle)) ||
        u.email.toLowerCase().includes(needle) ||
        u.amaRole.toLowerCase().includes(needle) ||
        (phoneNeedle.length >= 3 && u.phone && u.phone.includes(phoneNeedle)),
    );
  }

  /* Stats tính trên TOÀN filtered list (trước khi slice) để counter Active /
   * Inactive vẫn phản ánh tổng kết quả search, không phụ thuộc trang đang xem. */
  const active = displayUsers.filter((u) => isActiveUser(u.lastLoginAt)).length;
  const inactive = displayUsers.length - active;
  const dataSource: 'ama' | 'v2-only' = amaMembers !== null ? 'ama' : 'v2-only';

  /* Pagination: slice sau filter, trước render. Data đã in-memory nên slice
   * O(1). Total dùng filtered length, không phải raw. */
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
            <RefreshUsersButton />
            {/* Quick path to driver creation — admin có thể vào trực tiếp /drivers/new
             *  thay vì 2-step (users/new → drivers/new). */}
            {actor.role === 'ADMIN' && (
              <Button asChild variant="secondary" size="md" iconLeft={<IdCard />}>
                <a href="/drivers/new">Tạo tài xế</a>
              </Button>
            )}
            {/* MANAGER cũng được mời user (driver/viewer) sau khi G1 enabled
             *  ở AMA-side OwnEntityManagerGuard. Service tự enforce role limit. */}
            {(actor.role === 'ADMIN' || actor.role === 'MANAGER') && (
              <Button asChild variant="accent" size="md" iconLeft={<Plus />}>
                <a href="/users/new">{tList('inviteUser')}</a>
              </Button>
            )}
          </>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-4">
        <div className="flex flex-col gap-3">
          {/* Status tabs — admin nhìn thấy user bị INACTIVE/SUSPENDED và có thể un-revoke. */}
          <div className="-mx-4 md:mx-0 px-4 md:px-0 overflow-x-auto">
            <div className="inline-flex items-center gap-1 rounded-md bg-surface-2 p-1">
              {STATUS_FILTERS.map((s) => {
                const active = statusFilter === s;
                const href = s === 'all' ? '/users' : `/users?status=${s}`;
                return (
                  <Link
                    key={s}
                    href={href}
                    className={
                      'inline-flex items-center gap-1.5 h-8 px-3 rounded text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
                      (active ? 'bg-surface text-text shadow-xs' : 'text-text-muted hover:text-text')
                    }
                  >
                    {tList(`status_${s}` as const)}
                    {statusCounts[s] > 0 && (
                      <span className="text-[10.5px] font-semibold text-text-faint tabular">
                        {statusCounts[s]}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <DebouncedSearchInput
              placeholder={tList('searchPlaceholder')}
              className="md:w-80"
              clearLabel={tA('clear')}
            />
            <div className="flex items-center gap-3 text-xs md:text-sm text-text-muted">
              {dataSource === 'v2-only' && (
                <Badge tone="warning" size="sm">v2 cache</Badge>
              )}
              <span>{tList('statsActive', { active, inactive })}</span>
            </div>
          </div>
        </div>

        {pagedUsers.length === 0 ? (
          <Card variant="outline" className="p-8 text-center">
            <div className="text-text-muted text-sm">
              Chưa có thành viên nào trong công ty này.
              {actor.role === 'ADMIN' && (
                <>
                  {' '}<a href="/users/new" className="text-accent hover:underline">Thêm thành viên mới</a>.
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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-text truncate">{u.name}</span>
                            {u.status !== 'ACTIVE' && (
                              <Badge
                                tone={u.status === 'SUSPENDED' ? 'danger' : 'warning'}
                                size="sm"
                              >
                                {u.status === 'SUSPENDED' ? 'Đình chỉ' : 'Tạm khoá'}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-text-faint truncate">{u.email}</div>
                        </div>
                        {u.localRole ? (
                          <Badge tone={LOCAL_ROLE_TONE[u.localRole]} size="sm">{u.localRole}</Badge>
                        ) : (
                          <Badge tone="neutral" size="sm">—</Badge>
                        )}
                      </div>
                      {u.phone && (
                        <div className="mt-1.5 flex items-center gap-1 text-xs">
                          <span className="text-text-muted">📱</span>
                          <a
                            href={`tel:${u.phone}`}
                            className="font-mono tabular text-text hover:underline"
                          >
                            {u.phone}
                          </a>
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-text-muted">
                          {tList('amaPrefix')}{' '}
                          <span className="font-mono">{u.amaRole}</span>
                        </span>
                        <span className="text-text-faint">{formatRelativeTime(u.lastLoginAt)}</span>
                      </div>
                      {/* Mobile: signin toggle inline cuối card cho driver. Admin/manager
                       *  edit qua /users/[id]/edit thông thường vì cần đổi nhiều field hơn. */}
                      {actor.role === 'ADMIN' && u.localRole === 'DRIVER' && !u.isCrossEntity && (
                        <div className="mt-2 pt-2 border-t border-border flex justify-end">
                          <DriverSigninToggle
                            amaUserId={u.amaUserId}
                            displayName={u.name}
                            currentStatus={u.status}
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
                    <TableHead>{tList('thPhone')}</TableHead>
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
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-text truncate">{u.name}</span>
                              {u.status !== 'ACTIVE' && (
                                <Badge
                                  tone={u.status === 'SUSPENDED' ? 'danger' : 'warning'}
                                  size="sm"
                                >
                                  {u.status === 'SUSPENDED' ? 'Đình chỉ' : 'Tạm khoá'}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-text-faint truncate">{u.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.phone ? (
                          <a
                            href={`tel:${u.phone}`}
                            className="font-mono text-sm tabular text-text hover:underline"
                          >
                            {u.phone}
                          </a>
                        ) : (
                          <span className="text-xs text-text-faint italic">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.localRole ? (
                          <Badge tone={LOCAL_ROLE_TONE[u.localRole]} size="sm">{u.localRole}</Badge>
                        ) : (
                          <span className="text-xs text-text-faint italic">Chưa login</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-text-muted">{u.amaRole}</TableCell>
                      <TableCell className="text-text-muted">
                        {formatRelativeTime(u.lastLoginAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        {actor.role === 'ADMIN' && !u.isCrossEntity ? (
                          <div className="inline-flex items-center gap-1 justify-end">
                            {/* Quick signin toggle — chỉ cho DRIVER role (admin/manager
                             *  revoke phải vào edit form để xác nhận role context). */}
                            {u.localRole === 'DRIVER' && (
                              <DriverSigninToggle
                                amaUserId={u.amaUserId}
                                displayName={u.name}
                                currentStatus={u.status}
                                compact
                              />
                            )}
                            <Button asChild variant="ghost" size="sm">
                              <a href={`/users/${u.amaUserId}/edit`}>{tA('edit')}</a>
                            </Button>
                          </div>
                        ) : u.isCrossEntity ? (
                          <span
                            className="text-xs text-text-faint italic"
                            title="System Admin — chỉnh sửa ở AMA portal"
                          >
                            Cross-entity
                          </span>
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
                      <a href={usersPageHref(page - 1, searchQ, statusFilter)}>{tList('previous')}</a>
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" disabled>{tList('previous')}</Button>
                  )}
                  <span className="px-3 text-sm tabular">{page} / {totalPages}</span>
                  {page < totalPages ? (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={usersPageHref(page + 1, searchQ, statusFilter)}>{tList('next')}</a>
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

function usersPageHref(page: number, q: string | undefined, status: StatusFilter): string {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (status !== 'all') params.set('status', status);
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `/users?${qs}` : '/users';
}

/** Convert AMA usr_role string sang local role nếu là 1 trong enum values v2 hiểu. */
function safeMapRole(amaRole: string): LocalRole | null {
  const validRoles: AmaJwtClaims['role'][] = [
    'OWNER', 'MASTER', 'ADMIN', 'SUPER_ADMIN', 'MANAGER', 'MEMBER', 'VIEWER',
  ];
  if (validRoles.includes(amaRole as AmaJwtClaims['role'])) {
    return mapAmaRoleToLocal(amaRole as AmaJwtClaims['role']);
  }
  return null;
}
