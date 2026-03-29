import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSeasonality, useUpdateSeasonality } from '@/hooks/useSettings';
import { PageHeader } from '@/components/common/PageHeader';
import { useToastStore } from '@/stores/toast.store';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function SeasonalityPage() {
  const { t } = useTranslation('stock');
  const { data } = useSeasonality();
  const update = useUpdateSeasonality();
  const { showToast } = useToastStore();
  const [indices, setIndices] = useState<Record<number, number>>({});

  useEffect(() => {
    if (data?.data) {
      const map: Record<number, number> = {};
      (data.data as { ssiMonth: number; ssiIndex: number }[]).forEach(i => { map[i.ssiMonth] = i.ssiIndex; });
      setIndices(map);
    }
  }, [data]);

  const handleSave = async () => {
    const items = Object.entries(indices).map(([m, idx]) => ({ month: Number(m), index: Number(idx) }));
    try { await update.mutateAsync(items); showToast('Saved', 'success'); }
    catch { showToast('Error', 'error'); }
  };

  return (
    <div>
      <PageHeader title={t('settings.seasonTitle')} breadcrumb={['stock-management', 'settings', 'seasonality']} />
      <div className="max-w-lg rounded-xl border border-[#e2e5eb] bg-white p-6">
        <div className="grid grid-cols-3 gap-3">
          {MONTHS.map((m, i) => (
            <div key={i}>
              <label className="mb-1 block text-xs font-medium text-gray-500">{m}</label>
              <input type="number" step="0.01" value={indices[i + 1] ?? 1} onChange={(e) => setIndices(p => ({ ...p, [i + 1]: Number(e.target.value) }))} className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none" />
            </div>
          ))}
        </div>
        <button onClick={handleSave} className="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500">{t('common.save')}</button>
      </div>
    </div>
  );
}
