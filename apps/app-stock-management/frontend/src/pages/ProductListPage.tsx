import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';

export function ProductListPage() {
  const { t } = useTranslation('stock');
  const navigate = useNavigate();
  const { data, isLoading } = useProducts();
  const products: Record<string, unknown>[] = data?.data || [];

  const columns: Column<Record<string, unknown>>[] = [
    { key: 'prdCode', label: t('product.code') },
    { key: 'prdName', label: t('product.name') },
    { key: 'prdCategory', label: t('product.category') },
    { key: 'prdBrand', label: t('product.brand') },
  ];

  return (
    <div>
      <PageHeader
        title={t('product.title')}
        breadcrumb={['stock-management', 'products']}
        actions={
          <button onClick={() => navigate('/products/new')} className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-emerald-500">
            <Plus className="h-3.5 w-3.5" /> {t('product.addProduct')}
          </button>
        }
      />
      <DataTable columns={columns} data={products} isLoading={isLoading} onRowClick={(r) => navigate(`/products/${r.prdId}/edit`)} />
    </div>
  );
}
