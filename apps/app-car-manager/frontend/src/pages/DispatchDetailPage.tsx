import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDispatch, useDispatchAction } from '@/hooks/useDispatches';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge, getStatusVariant } from '@/components/common/StatusBadge';
import { DispatchConfirmModal } from '@/components/dispatch/DispatchConfirmModal';

export function DispatchDetailPage() {
  const { t } = useTranslation('car');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useDispatch(id!);
  const actionMut = useDispatchAction();
  const [showConfirm, setShowConfirm] = useState(false);

  const dispatch = data?.data;

  if (isLoading) return <div className="py-10 text-center text-gray-500">{t('common.loading')}</div>;
  if (!dispatch) return <div className="py-10 text-center text-gray-400">{t('common.noData')}</div>;

  const handleAction = async (action: string, data?: Record<string, unknown>) => {
    await actionMut.mutateAsync({ id: id!, action, data });
  };

  return (
    <div>
      <PageHeader
        title={`${t('dispatch.title')} #${(dispatch.dispatchId as string).slice(0, 8)}`}
        breadcrumb={['app-car-manager', t('nav.dispatchBoard'), t('dispatch.title')]}
        actions={
          <StatusBadge variant={getStatusVariant(dispatch.status)} label={dispatch.status} />
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
              <Row label={t('dispatch.requester')} value={dispatch.requesterName} />
              <Row label={t('dispatch.purposeType')} value={dispatch.purposeType} />
              <Row label={t('dispatch.purpose')} value={dispatch.purpose} />
              <Row label={t('dispatch.origin')} value={dispatch.origin} />
              <Row label={t('dispatch.destination')} value={dispatch.destination} />
              <Row label={t('dispatch.departAt')} value={dispatch.departAt ? new Date(dispatch.departAt).toLocaleString() : '-'} />
              <Row label={t('dispatch.returnAt')} value={dispatch.returnAt ? new Date(dispatch.returnAt).toLocaleString() : '-'} />
              <Row label={t('dispatch.passengers')} value={dispatch.passengerCount} />
              {dispatch.note && <Row label={t('dispatch.note')} value={dispatch.note} />}
            </dl>
          </div>

          {/* Assignment & Status */}
          <div className="rounded-[10px] border border-[#e2e5eb] bg-white p-5">
            <div className="mb-4 border-b border-[#e2e5eb] pb-2.5 text-[12px] font-semibold uppercase tracking-wide text-gray-400">
              {t('dispatchDetail.assignmentStatus')}
            </div>
            <dl className="space-y-2.5 text-sm">
              <Row label={t('dispatch.vehicle')} value={dispatch.vehiclePlateNumber || '-'} />
              <Row label={t('dispatch.driver')} value={dispatch.driverName || '-'} />
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
        <div className="flex flex-wrap gap-2">
          {dispatch.status === 'PENDING' && (
            <>
              <button
                onClick={() => setShowConfirm(true)}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-400"
              >
                {t('dispatch.confirmDispatch')}
              </button>
              <button
                onClick={() => {
                  const reason = prompt(t('dispatchDetail.rejectReasonPrompt'));
                  if (reason) handleAction('reject', { reason });
                }}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                {t('dispatch.reject')}
              </button>
            </>
          )}
          {dispatch.status === 'DRIVER_ACCEPTED' && (
            <button onClick={() => handleAction('depart')} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">
              {t('dispatch.depart')}
            </button>
          )}
          {dispatch.status === 'DEPARTED' && (
            <button onClick={() => handleAction('arrive')} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">
              {t('dispatch.arrive')}
            </button>
          )}
          {dispatch.status === 'ARRIVED' && (
            <button onClick={() => handleAction('complete')} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500">
              {t('dispatch.complete')}
            </button>
          )}
          {!['COMPLETED', 'CANCELLED', 'REJECTED'].includes(dispatch.status) && (
            <button
              onClick={() => {
                const reason = prompt(t('dispatchDetail.cancelReasonPrompt'));
                if (reason) handleAction('cancel', { reason });
              }}
              className="rounded-lg border border-[#d4d8e0] px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              {t('dispatch.cancelDispatch')}
            </button>
          )}
        </div>
      </div>

      {/* Dispatch Confirm Modal */}
      {showConfirm && (
        <DispatchConfirmModal
          dispatch={dispatch}
          onClose={() => setShowConfirm(false)}
        />
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
