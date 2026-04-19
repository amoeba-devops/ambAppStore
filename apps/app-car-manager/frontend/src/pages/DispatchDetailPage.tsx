import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDispatch, useDispatchAction, useUpdateDispatch } from '@/hooks/useDispatches';
import { useDrivers } from '@/hooks/useDrivers';
import { Pencil, Save, X } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge, getStatusVariant } from '@/components/common/StatusBadge';
import { DispatchConfirmModal } from '@/components/dispatch/DispatchConfirmModal';

export function DispatchDetailPage() {
  const { t } = useTranslation('car');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, refetch } = useDispatch(id!);
  const actionMut = useDispatchAction();
  const updateMut = useUpdateDispatch();
  const { data: driversData } = useDrivers();
  const allDrivers: Record<string, unknown>[] = driversData?.data || [];
  const [showConfirm, setShowConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [editDriverId, setEditDriverId] = useState<string>('');

  const dispatch = data?.data;

  if (isLoading) return <div className="py-10 text-center text-gray-500">{t('common.loading')}</div>;
  if (!dispatch) return <div className="py-10 text-center text-gray-400">{t('common.noData')}</div>;

  const handleAction = async (action: string, data?: Record<string, unknown>) => {
    await actionMut.mutateAsync({ id: id!, action, data });
  };

  const startEdit = () => {
    setEditData({
      requester_name: dispatch.requesterName || '',
      purpose: dispatch.purpose || '',
      origin: dispatch.origin || '',
      destination: dispatch.destination || '',
      note: dispatch.note || '',
    });
    setEditDriverId(dispatch.driverId || '');
    setEditing(true);
  };

  const saveEdit = async () => {
    const payload: Record<string, unknown> = { ...editData };
    if (editDriverId !== (dispatch.driverId || '')) {
      payload.driver_id = editDriverId || null;
    }
    await updateMut.mutateAsync({ id: id!, data: payload });
    setEditing(false);
    refetch();
  };

  const canEdit = ['PENDING', 'APPROVED'].includes(dispatch.status);

  return (
    <div>
      <PageHeader
        title={`${t('dispatch.title')} #${(dispatch.dispatchId as string).slice(0, 8)}`}
        breadcrumb={['app-car-manager', t('nav.dispatchBoard'), t('dispatch.title')]}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge variant={getStatusVariant(dispatch.status)} label={dispatch.status} />
            {canEdit && !editing && (
              <button
                onClick={startEdit}
                className="flex items-center gap-1 rounded-md border border-[#d4d8e0] bg-white px-3 py-1.5 text-[12px] font-medium text-gray-600 hover:text-gray-900"
              >
                <Pencil className="h-3.5 w-3.5" />
                {t('common.edit')}
              </button>
            )}
            {editing && (
              <>
                <button
                  onClick={saveEdit}
                  disabled={updateMut.isPending}
                  className="flex items-center gap-1 rounded-md bg-orange-500 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-orange-400 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {t('common.save')}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="flex items-center gap-1 rounded-md border border-[#d4d8e0] px-3 py-1.5 text-[12px] font-medium text-gray-600 hover:text-gray-900"
                >
                  <X className="h-3.5 w-3.5" />
                  {t('common.cancel')}
                </button>
              </>
            )}
          </div>
        }
      />

      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Request Info */}
          <div className="rounded-[10px] border border-[#e2e5eb] bg-white p-5">
            <div className="mb-4 border-b border-[#e2e5eb] pb-2.5 text-[12px] font-semibold uppercase tracking-wide text-gray-400">
              {t('dispatchDetail.requestInfo')}
            </div>
            <dl className="space-y-2.5 text-sm">
              {editing ? (
                <>
                  <EditRow label={t('dispatch.requester')} field="requester_name" value={editData.requester_name} onChange={(v) => setEditData((p) => ({ ...p, requester_name: v }))} />
                  <Row label={t('dispatch.purposeType')} value={dispatch.purposeType} />
                  <EditRow label={t('dispatch.purpose')} field="purpose" value={editData.purpose} onChange={(v) => setEditData((p) => ({ ...p, purpose: v }))} />
                  <EditRow label={t('dispatch.origin')} field="origin" value={editData.origin} onChange={(v) => setEditData((p) => ({ ...p, origin: v }))} />
                  <EditRow label={t('dispatch.destination')} field="destination" value={editData.destination} onChange={(v) => setEditData((p) => ({ ...p, destination: v }))} />
                  <Row label={t('dispatch.departAt')} value={dispatch.departAt ? new Date(dispatch.departAt).toLocaleString() : '-'} />
                  <Row label={t('dispatch.returnAt')} value={dispatch.returnAt ? new Date(dispatch.returnAt).toLocaleString() : '-'} />
                  <Row label={t('dispatch.passengers')} value={dispatch.passengerCount} />
                  <EditRow label={t('dispatch.note')} field="note" value={editData.note} onChange={(v) => setEditData((p) => ({ ...p, note: v }))} />
                </>
              ) : (
                <>
                  <Row label={t('dispatch.requester')} value={dispatch.requesterName} />
                  <Row label={t('dispatch.purposeType')} value={dispatch.purposeType} />
                  <Row label={t('dispatch.purpose')} value={dispatch.purpose} />
                  <Row label={t('dispatch.origin')} value={dispatch.origin} />
                  <Row label={t('dispatch.destination')} value={dispatch.destination} />
                  <Row label={t('dispatch.departAt')} value={dispatch.departAt ? new Date(dispatch.departAt).toLocaleString() : '-'} />
                  <Row label={t('dispatch.returnAt')} value={dispatch.returnAt ? new Date(dispatch.returnAt).toLocaleString() : '-'} />
                  <Row label={t('dispatch.passengers')} value={dispatch.passengerCount} />
                  {dispatch.note && <Row label={t('dispatch.note')} value={dispatch.note} />}
                </>
              )}
            </dl>
          </div>

          {/* Assignment & Status */}
          <div className="rounded-[10px] border border-[#e2e5eb] bg-white p-5">
            <div className="mb-4 border-b border-[#e2e5eb] pb-2.5 text-[12px] font-semibold uppercase tracking-wide text-gray-400">
              {t('dispatchDetail.assignmentStatus')}
            </div>
            <dl className="space-y-2.5 text-sm">
              <Row label={t('dispatch.vehicle')} value={dispatch.vehiclePlateNumber || '-'} />
              {editing ? (
                <div className="flex items-center justify-between border-b border-[#eef0f4] py-1">
                  <dt className="text-[13px] text-gray-500">{t('dispatch.driver')}</dt>
                  <dd>
                    <select
                      value={editDriverId}
                      onChange={(e) => setEditDriverId(e.target.value)}
                      className="w-48 rounded border border-orange-300 px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-orange-500"
                    >
                      <option value="">— {t('dispatch.selectDriver')} —</option>
                      {allDrivers.map((d) => (
                        <option key={d.driverId as string} value={d.driverId as string}>
                          {(d.driverName as string) || (d.amaUserId as string)} ({d.role as string})
                        </option>
                      ))}
                    </select>
                  </dd>
                </div>
              ) : (
                <Row label={t('dispatch.driver')} value={dispatch.driverName || '-'} />
              )}
              <Row label={t('dispatchDetail.approvedAt')} value={dispatch.approvedAt ? new Date(dispatch.approvedAt).toLocaleString() : '-'} />
              <Row label={t('dispatchDetail.departedAt')} value={dispatch.departedAt ? new Date(dispatch.departedAt).toLocaleString() : '-'} />
              <Row label={t('dispatchDetail.arrivedAt')} value={dispatch.arrivedAt ? new Date(dispatch.arrivedAt).toLocaleString() : '-'} />
              <Row label={t('dispatchDetail.completedAt')} value={dispatch.completedAt ? new Date(dispatch.completedAt).toLocaleString() : '-'} />
            </dl>
            {dispatch.rejectReason && (
              <p className="mt-3 text-sm text-red-600">{t('dispatchDetail.rejectReason')}: {dispatch.rejectReason}</p>
            )}
            {dispatch.cancelReason && (
              <p className="mt-3 text-sm text-red-600">{t('dispatchDetail.cancelReason')}: {dispatch.cancelReason}</p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {!editing && (
          <div className="flex flex-wrap gap-2">
            {dispatch.status === 'PENDING' && (
              <>
                <button onClick={() => setShowConfirm(true)} className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-400">
                  {t('dispatch.confirmDispatch')}
                </button>
                <button
                  onClick={() => { const r = prompt(t('dispatchDetail.rejectReasonPrompt')); if (r) handleAction('reject', { reason: r }); }}
                  className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  {t('dispatch.reject')}
                </button>
              </>
            )}
            {dispatch.status === 'DRIVER_ACCEPTED' && (
              <button onClick={() => handleAction('depart')} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">{t('dispatch.depart')}</button>
            )}
            {(dispatch.status === 'APPROVED' && dispatch.driverOverride) && (
              <button onClick={() => handleAction('depart')} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">{t('dispatch.depart')}</button>
            )}
            {dispatch.status === 'DEPARTED' && (
              <button onClick={() => handleAction('arrive')} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">{t('dispatch.arrive')}</button>
            )}
            {dispatch.status === 'ARRIVED' && (
              <button onClick={() => handleAction('complete')} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500">{t('dispatch.complete')}</button>
            )}
            {!['COMPLETED', 'CANCELLED', 'REJECTED'].includes(dispatch.status) && (
              <button
                onClick={() => { const r = prompt(t('dispatchDetail.cancelReasonPrompt')); if (r) handleAction('cancel', { reason: r }); }}
                className="rounded-lg border border-[#d4d8e0] px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                {t('dispatch.cancelDispatch')}
              </button>
            )}
          </div>
        )}
      </div>

      {showConfirm && (
        <DispatchConfirmModal dispatch={dispatch} onClose={() => setShowConfirm(false)} />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex justify-between border-b border-[#eef0f4] py-1.5">
      <dt className="text-[13px] text-gray-500">{label}</dt>
      <dd className="text-[13px] font-medium text-gray-900">{value != null ? String(value) : '-'}</dd>
    </div>
  );
}

function EditRow({ label, field, value, onChange }: { label: string; field: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between border-b border-[#eef0f4] py-1">
      <dt className="text-[13px] text-gray-500">{label}</dt>
      <dd>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-48 rounded border border-orange-300 px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
      </dd>
    </div>
  );
}
