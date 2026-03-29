import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParameters, useUpdateParameters } from '@/hooks/useSettings';
import { PageHeader } from '@/components/common/PageHeader';
import { useToastStore } from '@/stores/toast.store';

export function ParameterSettingsPage() {
  const { t } = useTranslation('stock');
  const { data } = useParameters();
  const update = useUpdateParameters();
  const { showToast } = useToastStore();
  const [form, setForm] = useState({
    prmLt1Days: 3, prmLt2Days: 7, prmLt3Days: 14, prmLt4Days: 3, prmLt5Days: 1,
    prmServiceLevel: 95, prmReviewPeriodWeeks: 4, prmSmaWeeks: 12,
  });

  useEffect(() => {
    if (data?.data) {
      const d = data.data;
      setForm({
        prmLt1Days: d.prmLt1Days || 3, prmLt2Days: d.prmLt2Days || 7, prmLt3Days: d.prmLt3Days || 14,
        prmLt4Days: d.prmLt4Days || 3, prmLt5Days: d.prmLt5Days || 1,
        prmServiceLevel: d.prmServiceLevel || 95, prmReviewPeriodWeeks: d.prmReviewPeriodWeeks || 4,
        prmSmaWeeks: d.prmSmaWeeks || 12,
      });
    }
  }, [data]);

  const handleSave = async () => {
    try { await update.mutateAsync(form); showToast('Saved', 'success'); }
    catch { showToast('Error', 'error'); }
  };

  const fields = [
    { key: 'prmLt1Days', label: t('settings.lt1') },
    { key: 'prmLt2Days', label: t('settings.lt2') },
    { key: 'prmLt3Days', label: t('settings.lt3') },
    { key: 'prmLt4Days', label: t('settings.lt4') },
    { key: 'prmLt5Days', label: t('settings.lt5') },
    { key: 'prmServiceLevel', label: t('settings.serviceLevel') },
    { key: 'prmReviewPeriodWeeks', label: t('settings.reviewPeriod') },
    { key: 'prmSmaWeeks', label: t('settings.smaWeeks') },
  ];

  return (
    <div>
      <PageHeader title={t('settings.paramTitle')} breadcrumb={['stock-management', 'settings', 'parameters']} />
      <div className="max-w-lg space-y-4 rounded-xl border border-[#e2e5eb] bg-white p-6">
        {fields.map(f => (
          <div key={f.key}>
            <label className="mb-1 block text-sm font-medium text-gray-700">{f.label}</label>
            <input type="number" value={(form as Record<string, number>)[f.key] || 0} onChange={(e) => setForm(p => ({ ...p, [f.key]: Number(e.target.value) }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
          </div>
        ))}
        <button onClick={handleSave} className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500">{t('common.save')}</button>
      </div>
    </div>
  );
}
