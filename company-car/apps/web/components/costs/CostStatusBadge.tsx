import type { CostStatus } from '@repo/api-types';
import { useTranslations } from 'next-intl';

const STYLE: Record<CostStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600 border-gray-200',
  PENDING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED_TO_PROCEED: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  SUBMITTED: 'bg-blue-50 text-blue-700 border-blue-200',
  APPROVED: 'bg-green-50 text-green-700 border-green-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
};

export function CostStatusBadge({ status }: { status: CostStatus }) {
  const t = useTranslations('cost.status');
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLE[status]}`}
    >
      {t(status)}
    </span>
  );
}
