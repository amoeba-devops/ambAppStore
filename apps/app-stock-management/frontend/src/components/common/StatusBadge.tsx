import { clsx } from 'clsx';

const colorMap: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  PENDING_IN: 'bg-yellow-100 text-yellow-800',
  INACTIVE: 'bg-gray-100 text-gray-600',
  DISCONTINUED: 'bg-red-100 text-red-800',
  DRAFT: 'bg-gray-100 text-gray-600',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  SHIPPED: 'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  PROPOSED: 'bg-yellow-100 text-yellow-800',
  ADJUSTED: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  EXPECTED: 'bg-sky-100 text-sky-800',
  IN_TRANSIT: 'bg-blue-100 text-blue-800',
  ARRIVED: 'bg-indigo-100 text-indigo-800',
  INSPECTING: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-green-100 text-green-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  NORMAL: 'bg-gray-100 text-gray-600',
  URGENT: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800',
  HIGH: 'bg-red-100 text-red-800',
  MEDIUM: 'bg-orange-100 text-orange-800',
  LOW: 'bg-green-100 text-green-800',
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={clsx('inline-flex rounded-full px-2 py-0.5 text-xs font-semibold', colorMap[status] || 'bg-gray-100 text-gray-600')}>
      {label || status}
    </span>
  );
}
