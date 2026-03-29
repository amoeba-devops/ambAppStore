import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useChannels, useCreateChannel } from '@/hooks/useSettings';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { useToastStore } from '@/stores/toast.store';

export function ChannelListPage() {
  const { t } = useTranslation('stock');
  const { data, isLoading } = useChannels();
  const create = useCreateChannel();
  const { showToast } = useToastStore();
  const channels: Record<string, unknown>[] = data?.data || [];
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ chnName: '', chnType: 'B2C' });

  const columns: Column<Record<string, unknown>>[] = [
    { key: 'chnName', label: 'Name' },
    { key: 'chnType', label: 'Type' },
  ];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await create.mutateAsync(form); showToast('Created', 'success'); setShowForm(false); }
    catch { showToast('Error', 'error'); }
  };

  return (
    <div>
      <PageHeader title={t('settings.channelTitle')} breadcrumb={['stock-management', 'settings', 'channels']} actions={<button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-emerald-500"><Plus className="h-3.5 w-3.5" /> Add</button>} />
      {showForm && (
        <form onSubmit={handleCreate} className="mb-4 flex gap-3 rounded-xl border border-[#e2e5eb] bg-white p-4">
          <input type="text" placeholder="Name" value={form.chnName} onChange={(e) => setForm(p => ({ ...p, chnName: e.target.value }))} className="rounded border px-2 py-1 text-sm" />
          <select value={form.chnType} onChange={(e) => setForm(p => ({ ...p, chnType: e.target.value }))} className="rounded border px-2 py-1 text-sm"><option value="B2C">B2C</option><option value="B2B">B2B</option></select>
          <button type="submit" className="rounded bg-emerald-600 px-3 py-1 text-sm text-white">{t('common.save')}</button>
        </form>
      )}
      <DataTable columns={columns} data={channels} isLoading={isLoading} />
    </div>
  );
}
