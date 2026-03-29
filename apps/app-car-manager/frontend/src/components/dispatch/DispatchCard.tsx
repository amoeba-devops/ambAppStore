import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { ProgressBar } from '@/components/common/ProgressBar';

interface DispatchCardProps {
  dispatch: Record<string, unknown>;
  onApprove?: () => void;
  onReject?: () => void;
  onClick?: () => void;
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export function DispatchCard({ dispatch, onApprove, onReject, onClick }: DispatchCardProps) {
  const { t } = useTranslation('car');

  const status = dispatch.status as string;
  const isPending = status === 'PENDING';
  const isRunning = ['DEPARTED', 'ARRIVED', 'DRIVER_ACCEPTED'].includes(status);
  const isCompleted = status === 'COMPLETED';

  const departAt = dispatch.departAt as string;
  const returnAt = dispatch.returnAt as string;
  const dispatchId = dispatch.dispatchId as string;
  const requesterName = dispatch.requesterName as string;
  const purposeType = dispatch.purposeType as string;
  const purpose = dispatch.purpose as string;
  const origin = dispatch.origin as string;
  const destination = dispatch.destination as string;
  const passengerCount = (dispatch.passengerCount as number) || 0;
  const vehiclePlate = (dispatch.vehiclePlateNumber as string) || '';
  const driverName = (dispatch.driverName as string) || '';
  const isProxy = Boolean(dispatch.isProxy);
  const createdAt = (dispatch.createdAt as string) || '';
  const distanceKm = dispatch.distanceKm as number | undefined;

  const dateStr = new Date(departAt).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit', weekday: 'short' });
  const timeRange = `${new Date(departAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ~ ${new Date(returnAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  const purposeIcon = purposeType === 'BUSINESS' ? '🏢' : purposeType === 'CLIENT' ? '🤝' : '📦';
  // Progress for running dispatches
  let progress = 0;
  if (status === 'DRIVER_ACCEPTED') progress = 30;
  if (status === 'DEPARTED') progress = 60;
  if (status === 'ARRIVED') progress = 85;

  return (
    <div
      onClick={onClick}
      className={clsx(
        'cursor-pointer rounded-md border border-[#d4d8e0] bg-[#f0f2f5] p-3 transition-colors hover:border-orange-500/25',
        isCompleted && 'opacity-80',
      )}
    >
      {/* Top: ID + time */}
      <div className="mb-2 flex items-start justify-between">
        <span className="font-mono text-[10px] text-gray-400">
          #{dispatchId.slice(0, 12)}
        </span>
        {isPending && createdAt && (
          <span className="text-[10px] text-yellow-600">
            🔥 {getTimeAgo(createdAt)}
          </span>
        )}
        {isRunning && (
          <span className="flex items-center gap-1 text-[10px] text-gray-600">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-gray-500" />
            {t('monitor.running')}
          </span>
        )}
        {isCompleted && (
          <span className="text-[10px] text-green-600">✓ {t('dispatch.statusCompleted')}</span>
        )}
      </div>

      {/* Requester */}
      <div className="mb-0.5 flex items-center gap-1.5">
        <span className="text-[13px] font-semibold text-gray-900">
          {requesterName}
        </span>
        {isProxy && (
          <span className="rounded-full bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-purple-600">
            {t('dispatch.proxy')}
          </span>
        )}
      </div>

      {/* Purpose */}
      <div className="mb-2 text-[11px] text-gray-600">
        {purposeIcon} {purpose}
      </div>

      {/* Meta */}
      <div className="flex flex-col gap-0.5 text-[11px] text-gray-400">
        <div className="flex items-center gap-1">
          📅 <strong className="text-gray-600">{dateStr}</strong> {timeRange}
        </div>
        <div className="flex items-center gap-1">
          📍 {origin} → {destination}
        </div>
        {isPending && (
          <div className="flex items-center gap-1">
            👤 {t('dispatch.passengers')} {passengerCount}{t('monitor.personsUnit')}
          </div>
        )}
        {(isRunning || isCompleted) && vehiclePlate && (
          <div className="flex items-center gap-1">
            🚗 <strong className="text-gray-600">{vehiclePlate}</strong>
          </div>
        )}
        {(isRunning || isCompleted) && driverName && (
          <div className="flex items-center gap-1">
            👨‍✈️ {t('dispatch.driver')}: <strong className="text-gray-600">{driverName}</strong>
          </div>
        )}
      </div>

      {/* Running progress */}
      {isRunning && (
        <div className="mt-2.5">
          <ProgressBar value={progress} max={100} color="blue" />
        </div>
      )}

      {/* Completed distance */}
      {isCompleted && distanceKm && (
        <div className="mt-1 text-right font-mono text-[11px] text-gray-400">
          {distanceKm}km
        </div>
      )}

      {/* Pending actions */}
      {isPending && (onApprove || onReject) && (
        <div className="mt-2.5 flex gap-1.5">
          {onApprove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onApprove();
              }}
              className="flex-1 rounded-md bg-orange-500 px-2 py-1.5 text-[12px] font-medium text-white hover:bg-orange-400"
            >
              {t('dispatch.confirmDispatch')}
            </button>
          )}
          {onReject && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReject();
              }}
              className="rounded-md border border-[#d4d8e0] bg-[#f0f2f5] px-2 py-1.5 text-[12px] font-medium text-gray-600 hover:text-gray-900"
            >
              {t('dispatch.reject')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
