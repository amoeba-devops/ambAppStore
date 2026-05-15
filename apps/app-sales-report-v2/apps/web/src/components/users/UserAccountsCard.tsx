'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus } from 'lucide-react';
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
    if (!confirm(`Deactivate ${row.name ?? row.email}? They won't be able to access this app.`)) return;
    if (isMockUserId(row.usrId)) {
      setMockUserStatus(row, 'INACTIVE');
      setFeedback({ tone: 'success', msg: 'User deactivated' });
      return;
    }
    setPendingId(row.usrId);
    const res = await deactivateUserAction({ usrId: row.usrId });
    setPendingId(null);
    if (!res.success) {
      setFeedback({ tone: 'error', msg: res.error.message });
      return;
    }
    setFeedback({ tone: 'success', msg: 'User deactivated' });
    void refresh();
  };

  const onActivate = async (row: UserRow) => {
    if (row.role === 'UNASSIGNED') {
      setFeedback({
        tone: 'error',
        msg: 'Assign a role before activating — click Edit to pick OPERATOR / MANAGER / ADMIN.',
      });
      setModal({ mode: 'edit', initial: row });
      return;
    }
    if (isMockUserId(row.usrId)) {
      setMockUserStatus(row, 'ACTIVE');
      setFeedback({ tone: 'success', msg: 'User activated' });
      return;
    }
    setPendingId(row.usrId);
    const res = await activateUserAction({ usrId: row.usrId });
    setPendingId(null);
    if (!res.success) {
      setFeedback({ tone: 'error', msg: res.error.message });
      return;
    }
    setFeedback({ tone: 'success', msg: 'User activated' });
    void refresh();
  };

  const onResetPwd = async (row: UserRow) => {
    if (!confirm(`Send password reset reminder for ${row.email}?\nNote: Passwords are managed by AMA. This logs the request only.`)) return;
    if (isMockUserId(row.usrId)) {
      setFeedback({
        tone: 'success',
        msg: 'Reset request logged (mock). Direct user to ama.amoeba.site',
      });
      return;
    }
    setPendingId(row.usrId);
    const res = await resetPasswordAction({ usrId: row.usrId });
    setPendingId(null);
    if (!res.success) {
      setFeedback({ tone: 'error', msg: res.error.message });
      return;
    }
    setFeedback({ tone: 'success', msg: 'Reset request logged. Direct user to ama.amoeba.site' });
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-neutral-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">User Accounts</h2>
          <p className="mt-0.5 text-xs text-neutral-500">FR-22 — Role-based access control</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users…"
              className="w-44 rounded-md border border-neutral-300 bg-white py-1.5 pl-8 pr-3 text-sm placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm"
          >
            <option value="ALL">All roles</option>
            <option value="ADMIN">Admin</option>
            <option value="MANAGER">Manager</option>
            <option value="OPERATOR">Operator</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm"
          >
            <option value="ALL">All status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <button
            type="button"
            onClick={() => setModal({ mode: 'add', initial: null })}
            className="inline-flex items-center gap-1 rounded-md bg-info-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-info-500/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Add User
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
              <th className="px-5 py-2.5 text-left font-medium">User</th>
              <th className="px-3 py-2.5 text-left font-medium">Email</th>
              <th className="px-3 py-2.5 text-left font-medium">Role</th>
              <th className="px-3 py-2.5 text-left font-medium">Status</th>
              <th className="px-3 py-2.5 text-left font-medium">Last Login</th>
              <th className="px-3 py-2.5 text-right font-medium">Login count</th>
              <th className="px-3 py-2.5 text-left font-medium">Created</th>
              <th className="px-5 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-sm text-neutral-500">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-sm text-neutral-500">
                  No users match your filters.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const isSelf = row.usrId === currentUserId;
              const isInactive = row.status === 'INACTIVE';
              return (
                <tr key={row.usrId} className="hover:bg-neutral-50/60">
                  <td className="px-5 py-3 font-semibold text-neutral-900">{row.name ?? '—'}</td>
                  <td className="px-3 py-3 text-neutral-700">{row.email ?? '—'}</td>
                  <td className="px-3 py-3">
                    {row.role === 'UNASSIGNED' ? (
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          ROLE_PILL.UNASSIGNED,
                        )}
                      >
                        Not assigned
                      </span>
                    ) : (
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          ROLE_PILL[row.role] ?? 'bg-neutral-100 text-neutral-700',
                        )}
                      >
                        {row.role[0] + row.role.slice(1).toLowerCase()}
                      </span>
                    )}
                    {row.amaRoleSnapshot && (
                      <div className="mt-0.5 text-[10px] text-neutral-400">
                        AMA: {row.amaRoleSnapshot}
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
                      {isInactive ? 'Inactive' : 'Active'}
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
                      <span className="text-xs italic text-neutral-500">Current user</span>
                    ) : (
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setModal({ mode: 'edit', initial: row })}
                          disabled={pendingId === row.usrId}
                          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onResetPwd(row)}
                          disabled={pendingId === row.usrId}
                          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                        >
                          Reset pwd
                        </button>
                        {isInactive ? (
                          <button
                            type="button"
                            onClick={() => onActivate(row)}
                            disabled={pendingId === row.usrId}
                            className="rounded-md border border-success-500 bg-white px-2 py-1 text-xs font-medium text-success-500 hover:bg-success-50 disabled:opacity-50"
                          >
                            Activate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onDeactivate(row)}
                            disabled={pendingId === row.usrId}
                            className="rounded-md border border-error-500 bg-white px-2 py-1 text-xs font-medium text-error-500 hover:bg-error-50 disabled:opacity-50"
                          >
                            Deactivate
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
          setFeedback({ tone: 'success', msg: modal?.mode === 'edit' ? 'User updated' : 'User added' });
          void refresh();
        }}
      />
    </div>
  );
}
