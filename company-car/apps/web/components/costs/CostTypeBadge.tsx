import type { CostType } from '@repo/api-types';
import { useTranslations } from 'next-intl';

const STYLE: Record<CostType, string> = {
  FUEL: 'bg-orange-50 text-orange-700',
  OIL_CHANGE: 'bg-purple-50 text-purple-700',
  ACCIDENT: 'bg-red-50 text-red-700',
  MEAL: 'bg-emerald-50 text-emerald-700',
  REPAIR_MAINTENANCE: 'bg-indigo-50 text-indigo-700',
};

export function CostTypeBadge({ type }: { type: CostType }) {
  const t = useTranslations('cost.type');
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${STYLE[type]}`}>
      {t(type)}
    </span>
  );
}
