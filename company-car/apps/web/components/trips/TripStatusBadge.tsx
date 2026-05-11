import type { TripStatus } from '@repo/api-types';
import { useTranslations } from 'next-intl';

const STYLE: Record<TripStatus, string> = {
  PENDING_DRIVER_CONFIRM: 'bg-amber-50 text-amber-700 border-amber-200',
  CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-200',
  DRIVER_REJECTED: 'bg-red-50 text-red-700 border-red-200',
  IN_PROGRESS: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  COMPLETED: 'bg-green-50 text-green-700 border-green-200',
  CANCELLED: 'bg-gray-100 text-gray-600 border-gray-200',
};

export function TripStatusBadge({ status }: { status: TripStatus }) {
  const t = useTranslations('trip.status');
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLE[status]}`}
    >
      {t(status)}
    </span>
  );
}
