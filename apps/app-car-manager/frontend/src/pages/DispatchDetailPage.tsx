import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDispatch, useApproveDispatch, useRejectDispatch, useDispatchAction } from '@/hooks/useDispatches';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';

export function DispatchDetailPage() {
  const { t } = useTranslation('car');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useDispatch(id!);
  const approveMut = useApproveDispatch();
  const rejectMut = useRejectDispatch();
  const actionMut = useDispatchAction();

  const dispatch = data?.data;

  if (isLoading) return <div className="py-10 text-center text-gray-500">{t('common.loading')}</div>;
  if (!dispatch) return <div className="py-10 text-center text-gray-400">{t('common.noData')}</div>;

  const handleAction = async (action: string, data?: Record<string, unknown>) => {
    await actionMut.mutateAsync({ id: id!, action, data });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/dispatches')} className="rounded p-1 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{t('dispatch.title')}</h1>
        <span className="rounded-full bg-blue-100 px-3 py-0.5 text-xs font-medium text-blue-700">
          {dispatch.status}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-900">요청 정보</h2>
          <dl className="space-y-2 text-sm">
            <Row label={t('dispatch.requester')} value={dispatch.requesterName} />
            <Row label={t('dispatch.purposeType')} value={dispatch.purposeType} />
            <Row label={t('dispatch.purpose')} value={dispatch.purpose} />
            <Row label={t('dispatch.origin')} value={dispatch.origin} />
            <Row label={t('dispatch.destination')} value={dispatch.destination} />
            <Row label={t('dispatch.departAt')} value={new Date(dispatch.departAt).toLocaleString()} />
            <Row label={t('dispatch.returnAt')} value={new Date(dispatch.returnAt).toLocaleString()} />
            <Row label={t('dispatch.passengers')} value={dispatch.passengerCount} />
          </dl>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-900">배정 & 상태</h2>
          <dl className="space-y-2 text-sm">
            <Row label={t('dispatch.vehicle')} value={dispatch.vehiclePlateNumber || '-'} />
            <Row label={t('dispatch.driver')} value={dispatch.driverName || '-'} />
            <Row label="Approved At" value={dispatch.approvedAt ? new Date(dispatch.approvedAt).toLocaleString() : '-'} />
            <Row label="Departed At" value={dispatch.departedAt ? new Date(dispatch.departedAt).toLocaleString() : '-'} />
            <Row label="Arrived At" value={dispatch.arrivedAt ? new Date(dispatch.arrivedAt).toLocaleString() : '-'} />
            <Row label="Completed At" value={dispatch.completedAt ? new Date(dispatch.completedAt).toLocaleString() : '-'} />
          </dl>
          {dispatch.rejectReason && <p className="mt-3 text-sm text-red-600">반려 사유: {dispatch.rejectReason}</p>}
          {dispatch.cancelReason && <p className="mt-3 text-sm text-red-600">취소 사유: {dispatch.cancelReason}</p>}
        </div>
      </div>

      {/* 상태별 액션 버튼 */}
      <div className="flex flex-wrap gap-2">
        {dispatch.status === 'DEPARTED' && (
          <button onClick={() => handleAction('arrive')} className="btn-primary">{t('dispatch.arrive')}</button>
        )}
        {dispatch.status === 'ARRIVED' && (
          <button onClick={() => handleAction('complete')} className="btn-primary">{t('dispatch.complete')}</button>
        )}
        {dispatch.status === 'DRIVER_ACCEPTED' && (
          <button onClick={() => handleAction('depart')} className="btn-primary">{t('dispatch.depart')}</button>
        )}
        {!['COMPLETED', 'CANCELLED', 'REJECTED'].includes(dispatch.status) && (
          <button
            onClick={() => {
              const reason = prompt('취소 사유를 입력하세요');
              if (reason) handleAction('cancel', { reason });
            }}
            className="btn-secondary text-red-600"
          >
            {t('dispatch.cancelDispatch')}
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex justify-between border-b border-gray-50 py-1">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value != null ? String(value) : '-'}</dd>
    </div>
  );
}
