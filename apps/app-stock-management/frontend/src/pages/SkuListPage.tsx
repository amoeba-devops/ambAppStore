import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useSkus } from '@/hooks/useSkus';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';

export function SkuListPage() {
  const { t } = useTranslation('stock');
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useSkus(search || undefined);
  const skus: Record<string, unknown>[] = data?.data || [];

  const columns: Column<Record<string, unknown>>[] = [
    { key: 'skuCode', label: t('sku.code') },
    { key: 'skuName', label: t('sku.name') },
    { key: 'skuSpec', label: t('sku.spec') },
    { key: 'skuUnit', label: t('sku.unit') },
    { key: 'skuMoq', label: t('sku.moq') },
    { key: 'skuSupplier', label: t('sku.supplier') },
    { key: 'skuStatus', label: t('sku.status'), render: (r) => <StatusBadge status={String(r.skuStatus)} /> },
  ];

  return (
    <div>
      <PageHeader
        title={t('sku.title')}
        breadcrumb={['stock-management', 'skus']}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-gray-400" />
              <input
                type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('common.search')}
                className="rounded-md border border-gray-300 py-1.5 pl-8 pr-3 text-[13px] focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <button onClick={() => navigate('/skus/new')} className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-emerald-500">
              <Plus className="h-3.5 w-3.5" /> {t('sku.addSku')}
            </button>
          </div>
        }
      />
      <DataTable columns={columns} data={skus} isLoading={isLoading} onRowClick={(r) => navigate(`/skus/${r.skuId}/edit`)} />
    </div>
  );
}
