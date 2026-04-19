import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useDispatches, useApproveDispatch, useRejectDispatch } from '@/hooks/useDispatches';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar, type FilterItem } from '@/components/common/FilterBar';
import { DispatchCard } from '@/components/dispatch/DispatchCard';
import { KanbanColumn } from '@/components/dispatch/KanbanColumn';
import { DispatchConfirmModal } from '@/components/dispatch/DispatchConfirmModal';
import { StatusBadge, getStatusVariant } from '@/components/common/StatusBadge';
import { Plus, LayoutGrid, List, ArrowUpDown } from 'lucide-react';

type DispatchItem = Record<string, unknown>;
type ViewMode = 'kanban' | 'list';
type SortKey = 'date' | 'requester' | 'status';

const PENDING_STATUSES = ['PENDING'];
const ACTIVE_STATUSES = ['APPROVED', 'DRIVER_ACCEPTED', 'DEPARTED', 'ARRIVED'];
const DONE_STATUSES = ['COMPLETED'];
const ALL_STATUSES = ['', 'PENDING', 'APPROVED', 'DEPARTED', 'ARRIVED', 'COMPLETED', 'CANCELLED', 'REJECTED'];

export function DispatchListPage() {
  const { t } = useTranslation('car');
  const navigate = useNavigate();
  const { data, isLoading } = useDispatches();
  const approveMut = useApproveDispatch();
  const rejectMut = useRejectDispatch();

  const [confirmTarget, setConfirmTarget] = useState<DispatchItem | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortAsc, setSortAsc] = useState(false);

  const dispatches: DispatchItem[] = data?.data || [];

  // Kanban columns
  const { pending, active, done } = useMemo(() => {
    const p: DispatchItem[] = [];
    const a: DispatchItem[] = [];
    const d: DispatchItem[] = [];
    for (const item of dispatches) {
      const status = item.status as string;
      if (PENDING_STATUSES.includes(status)) p.push(item);
      else if (ACTIVE_STATUSES.includes(status)) a.push(item);
      else if (DONE_STATUSES.includes(status)) d.push(item);
    }
    return { pending: p, active: a, done: d };
  }, [dispatches]);

  // List view: filtered + sorted
  const filteredList = useMemo(() => {
    let list = [...dispatches];
    if (statusFilter) {
      list = list.filter((d) => d.status === statusFilter);
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') {
        cmp = new Date(a.departAt as string).getTime() - new Date(b.departAt as string).getTime();
      } else if (sortKey === 'requester') {
        cmp = ((a.requesterName as string) || '').localeCompare((b.requesterName as string) || '');
      } else if (sortKey === 'status') {
        cmp = ((a.status as string) || '').localeCompare((b.status as string) || '');
      }
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [dispatches, statusFilter, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const statusFilters: FilterItem[] = ALL_STATUSES.map((s) => ({
    key: s,
    label: s ? s : t('common.all'),
  }));

  const handleApprove = (d: DispatchItem) => setConfirmTarget(d);
  const handleReject = async (d: DispatchItem) => {
    await rejectMut.mutateAsync({ id: d.dispatchId as string, reason: '' });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('dispatch.title')}
        liveBadge
        actions={
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg border border-[#d4d8e0] bg-white">
              <button
                onClick={() => setViewMode('kanban')}
                className={`rounded-l-lg px-2.5 py-1.5 ${viewMode === 'kanban' ? 'bg-orange-500 text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`rounded-r-lg px-2.5 py-1.5 ${viewMode === 'list' ? 'bg-orange-500 text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => navigate('/dispatches/new')}
              className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-400"
            >
              <Plus className="h-4 w-4" />
              {t('dispatch.createDispatch')}
            </button>
          </div>
        }
      />

      {isLoading ? (
        <div className="py-20 text-center text-gray-400">{t('common.loading')}</div>
      ) : viewMode === 'kanban' ? (
        /* Kanban View */
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <KanbanColumn title={t('dispatch.statusPending')} count={pending.length} color="yellow">
            {pending.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">{t('common.noData')}</div>
            ) : (
              pending.map((d) => (
                <DispatchCard key={d.dispatchId as string} dispatch={d} onApprove={() => handleApprove(d)} onReject={() => handleReject(d)} onClick={() => navigate(`/dispatches/${d.dispatchId}`)} />
              ))
            )}
          </KanbanColumn>
          <KanbanColumn title={t('dispatch.statusApproved')} count={active.length} color="blue">
            {active.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">{t('common.noData')}</div>
            ) : (
              active.map((d) => (
                <DispatchCard key={d.dispatchId as string} dispatch={d} onClick={() => navigate(`/dispatches/${d.dispatchId}`)} />
              ))
            )}
          </KanbanColumn>
          <KanbanColumn title={t('dispatch.statusCompleted')} count={done.length} color="green">
            {done.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">{t('common.noData')}</div>
            ) : (
              done.map((d) => (
                <DispatchCard key={d.dispatchId as string} dispatch={d} onClick={() => navigate(`/dispatches/${d.dispatchId}`)} />
              ))
            )}
          </KanbanColumn>
        </div>
      ) : (
        /* List View */
        <div className="space-y-3 p-2">
          {/* Filter bar */}
          <FilterBar
            label={`${t('common.status')}:`}
            items={statusFilters}
            selected={statusFilter}
            onChange={setStatusFilter}
          />

          {/* Table */}
          <div className="overflow-hidden rounded-[10px] border border-[#e2e5eb] bg-white">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e2e5eb] bg-[#f0f2f5]">
                  <SortTh label={t('dispatch.departAt')} sortKey="date" current={sortKey} asc={sortAsc} onSort={toggleSort} />
                  <SortTh label={t('dispatch.requester')} sortKey="requester" current={sortKey} asc={sortAsc} onSort={toggleSort} />
                  <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('dispatch.origin')} → {t('dispatch.destination')}</th>
                  <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('dispatch.vehicle')}</th>
                  <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('dispatch.driver')}</th>
                  <SortTh label={t('common.status')} sortKey="status" current={sortKey} asc={sortAsc} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {filteredList.length === 0 ? (
                  <tr><td colSpan={6} className="px-3.5 py-8 text-center text-[13px] text-gray-400">{t('common.noData')}</td></tr>
                ) : (
                  filteredList.map((d) => (
                    <tr
                      key={d.dispatchId as string}
                      onClick={() => navigate(`/dispatches/${d.dispatchId}`)}
                      className="cursor-pointer border-b border-[#e2e5eb] hover:bg-[#eef0f4]"
                    >
                      <td className="px-3.5 py-3 text-[13px]">
                        <div className="font-medium text-gray-900">{new Date(d.departAt as string).toLocaleDateString()}</div>
                        <div className="text-[11px] text-gray-400">
                          {new Date(d.departAt as string).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' ~ '}
                          {new Date(d.returnAt as string).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-3.5 py-3 text-[13px] font-medium text-gray-900">
                        {(d.requesterName as string) || '-'}
                      </td>
                      <td className="px-3.5 py-3 text-[12px] text-gray-600">
                        {d.origin as string} → {d.destination as string}
                      </td>
                      <td className="px-3.5 py-3 text-[12px] font-mono text-gray-600">
                        {(d.vehiclePlateNumber as string) || '-'}
                      </td>
                      <td className="px-3.5 py-3 text-[12px] text-gray-600">
                        {(d.driverName as string) || '-'}
                      </td>
                      <td className="px-3.5 py-3">
                        <StatusBadge variant={getStatusVariant(d.status as string)} label={d.status as string} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {confirmTarget && (
        <DispatchConfirmModal dispatch={confirmTarget} onClose={() => setConfirmTarget(null)} />
      )}
    </div>
  );
}

function SortTh({ label, sortKey, current, asc, onSort }: {
  label: string; sortKey: SortKey; current: SortKey; asc: boolean; onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className="cursor-pointer select-none px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400 hover:text-gray-600"
    >
      <span className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${active ? 'text-orange-500' : 'text-gray-300'}`} />
        {active && <span className="text-[9px] text-orange-500">{asc ? '↑' : '↓'}</span>}
      </span>
    </th>
  );
}
