'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@v2/ui';
import { fmtDateTime } from '@/lib/format';
import {
  listUsersAction,
  deactivateUserAction,
  activateUserAction,
  resetPasswordAction,
  type UserRow,
} from '@/server/actions/user.actions';
import {
  isMockUserId,
  setMockUserStatus,
  useEffectiveMockMembers,
} from '@/lib/users-state';
import { UserFormModal } from './UserFormModal';

type RoleFilter = 'ALL' | 'OPERATOR' | 'MANAGER' | 'ADMIN';
type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

const ROLE_PILL: Record<string, string> = {
  ADMIN: 'bg-info-50 text-info-500',
  MANAGER: 'bg-warning-50 text-warning-500',
  OPERATOR: 'bg-success-50 text-success-500',
  UNASSIGNED: 'bg-neutral-100 text-neutral-400 italic',
};

interface Props {
  initialRealRows: UserRow[];
  mockSeeds: UserRow[];
  currentUserId: string;
}

export function UserAccountsCard({ initialRealRows, mockSeeds, currentUserId }: Props) {
  const t = useTranslations('usersPage.accounts');
  const tCommon = useTranslations('common');
  const tRole = useTranslations('role');
  const tStatus = useTranslations('userStatus');
  const [realRows, setRealRows] = useState<UserRow[]>(initialRealRows);
  const effectiveMock = useEffectiveMockMembers(mockSeeds);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; initial: UserRow | null } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; msg: string } | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const firstRender = useRef(true);

  const roleLabel = (role: string): string => {
    switch (role) {
      case 'ADMIN':
        return tRole('admin');
      case 'MANAGER':
        return tRole('manager');
      case 'OPERATOR':
        return tRole('operator');
      case 'UNASSIGNED':
        return tRole('unassigned');
      default:
        return role;
    }
  };

  // Merge real + mock (real wins by email), then apply local search/role/status filters
  const rows = useMemo(() => {
    const realEmails = new Set(realRows.map((r) => r.email ?? '').filter(Boolean));
    const mockOnly = effectiveMock.filter((m) => !realEmails.has(m.email ?? ''));
    const all = [...realRows, ...mockOnly];
    const q = search.trim().toLowerCase();
    return all.filter((u) => {
      if (q && !((u.email ?? '').toLowerCase().includes(q) || (u.name ?? '').toLowerCase().includes(q))) {
        return false;
      }
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      if (statusFilter !== 'ALL' && u.status !== statusFilter) return false;
      return true;
    });
  }, [realRows, effectiveMock, search, roleFilter, statusFilter]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await listUsersAction({ search: search || undefined, role: roleFilter, status: statusFilter });
    setLoading(false);
    if (!res.success) {
      setFeedback({ tone: 'error', msg: res.error.message });
      return;
    }
    setRealRows(res.data.rows);
  }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void refresh();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [refresh]);

  useEffect(() => {
    if (!feedback) return;
    const handle = setTimeout(() => setFeedback(null), 3000);
    return () => clearTimeout(handle);
  }, [feedback]);

  const onDeactivate = async (row: UserRow) => {
    if (!confirm(t('confirm.deactivate', { target: row.name ?? row.email ?? '' }))) return;
    if (isMockUserId(row.usrId)) {
      setMockUserStatus(row, 'INACTIVE');
      setFeedback({ tone: 'success', msg: t('toast.deactivated') });
      return;
    }
    setPendingId(row.usrId);
    const res = await deactivateUserAction({ usrId: row.usrId });
    setPendingId(null);
    if (!res.success) {
      setFeedback({ tone: 'error', msg: res.error.message });
      return;
    }
    setFeedback({ tone: 'success', msg: t('toast.deactivated') });
    void refresh();
  };

  const onActivate = async (row: UserRow) => {
    if (row.role === 'UNASSIGNED') {
      setFeedback({ tone: 'error', msg: t('toast.assignRoleFirst') });
      setModal({ mode: 'edit', initial: row });
      return;
    }
    if (isMockUserId(row.usrId)) {
      setMockUserStatus(row, 'ACTIVE');
      setFeedback({ tone: 'success', msg: t('toast.activated') });
      return;
    }
    setPendingId(row.usrId);
    const res = await activateUserAction({ usrId: row.usrId });
    setPendingId(null);
    if (!res.success) {
      setFeedback({ tone: 'error', msg: res.error.message });
      return;
    }
    setFeedback({ tone: 'success', msg: t('toast.activated') });
    void refresh();
  };

  const onResetPwd = async (row: UserRow) => {
    if (!confirm(t('confirm.resetPwd', { email: row.email ?? '' }))) return;
    if (isMockUserId(row.usrId)) {
      setFeedback({ tone: 'success', msg: t('toast.resetMock') });
      return;
    }
    setPendingId(row.usrId);
    const res = await resetPasswordAction({ usrId: row.usrId });
    setPendingId(null);
    if (!res.success) {
      setFeedback({ tone: 'error', msg: res.error.message });
      return;
    }
    setFeedback({ tone: 'success', msg: t('toast.resetReal') });
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-neutral-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">{t('title')}</h2>
          <p className="mt-0.5 text-xs text-neutral-500">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-44 rounded-md border border-neutral-300 bg-white py-1.5 pl-8 pr-3 text-sm placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm"
          >
            <option value="ALL">{t('filterRoleAll')}</option>
            <option value="ADMIN">{tRole('admin')}</option>
            <option value="MANAGER">{tRole('manager')}</option>
            <option value="OPERATOR">{tRole('operator')}</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm"
          >
            <option value="ALL">{t('filterStatusAll')}</option>
            <option value="ACTIVE">{tStatus('active')}</option>
            <option value="INACTIVE">{tStatus('inactive')}</option>
          </select>
          <button
            type="button"
            onClick={() => setModal({ mode: 'add', initial: null })}
            className="inline-flex items-center gap-1 rounded-md bg-info-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-info-500/90"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('addUser')}
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={cn(
            'mx-5 mt-3 rounded-md border px-3 py-2 text-sm',
            feedback.tone === 'success'
              ? 'border-success-500 bg-success-50 text-success-500'
              : 'border-error-500 bg-error-50 text-error-500',
          )}
        >
          {feedback.msg}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-5 py-2.5 text-left font-medium">{t('column.user')}</th>
              <th className="px-3 py-2.5 text-left font-medium">{t('column.email')}</th>
              <th className="px-3 py-2.5 text-left font-medium">{t('column.role')}</th>
              <th className="px-3 py-2.5 text-left font-medium">{t('column.status')}</th>
              <th className="px-3 py-2.5 text-left font-medium">{t('column.lastLogin')}</th>
              <th className="px-3 py-2.5 text-right font-medium">{t('column.loginCount')}</th>
              <th className="px-3 py-2.5 text-left font-medium">{t('column.created')}</th>
              <th className="px-5 py-2.5 text-right font-medium">{t('column.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-sm text-neutral-500">
                  {tCommon('loading')}
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-sm text-neutral-500">
                  {t('empty')}
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const isSelf = row.usrId === currentUserId;
              const isInactive = row.status === 'INACTIVE';
              return (
                <tr key={row.usrId} className="hover:bg-neutral-50/60">
                  <td className="px-5 py-3 font-semibold text-neutral-900">
                    {row.name ?? tCommon('dash')}
                  </td>
                  <td className="px-3 py-3 text-neutral-700">{row.email ?? tCommon('dash')}</td>
                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        ROLE_PILL[row.role] ?? 'bg-neutral-100 text-neutral-700',
                      )}
                    >
                      {roleLabel(row.role)}
                    </span>
                    {row.amaRoleSnapshot && (
                      <div className="mt-0.5 text-[10px] text-neutral-400">
                        {t('amaPrefix', { role: row.amaRoleSnapshot })}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        isInactive ? 'bg-neutral-100 text-neutral-500' : 'bg-success-50 text-success-500',
                      )}
                    >
                      {isInactive ? tStatus('inactive') : tStatus('active')}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-neutral-500 whitespace-nowrap">
                    {fmtDateTime(row.lastLoginAt)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs text-neutral-700 tabular-nums">
                    {row.loginCount}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-neutral-500 whitespace-nowrap">
                    {fmtDateTime(row.createdAt)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {isSelf ? (
                      <span className="text-xs italic text-neutral-500">{tCommon('currentUser')}</span>
                    ) : (
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setModal({ mode: 'edit', initial: row })}
                          disabled={pendingId === row.usrId}
                          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                        >
                          {t('action.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => onResetPwd(row)}
                          disabled={pendingId === row.usrId}
                          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                        >
                          {t('action.resetPwd')}
                        </button>
                        {isInactive ? (
                          <button
                            type="button"
                            onClick={() => onActivate(row)}
                            disabled={pendingId === row.usrId}
                            className="rounded-md border border-success-500 bg-white px-2 py-1 text-xs font-medium text-success-500 hover:bg-success-50 disabled:opacity-50"
                          >
                            {t('action.activate')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onDeactivate(row)}
                            disabled={pendingId === row.usrId}
                            className="rounded-md border border-error-500 bg-white px-2 py-1 text-xs font-medium text-error-500 hover:bg-error-50 disabled:opacity-50"
                          >
                            {t('action.deactivate')}
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <UserFormModal
        open={!!modal}
        mode={modal?.mode ?? 'add'}
        initial={modal?.initial ?? null}
        onClose={() => setModal(null)}
        onSaved={() => {
          setModal(null);
          setFeedback({
            tone: 'success',
            msg: modal?.mode === 'edit' ? t('toast.updated') : t('toast.added'),
          });
          void refresh();
        }}
      />
    </div>
  );
}
