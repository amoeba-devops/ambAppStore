import { useTranslation } from 'react-i18next';
import { useForecasts } from '@/hooks/useForecasts';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';

export function ForecastListPage() {
  const { t } = useTranslation('stock');
  const { data, isLoading } = useForecasts();
  const forecasts: Record<string, unknown>[] = data?.data || [];

  const columns: Column<Record<string, unknown>>[] = [
    { key: 'skuId', label: 'SKU', render: (r) => String(r.skuId).slice(0, 8) },
    { key: 'fctPeriod', label: t('forecast.period') },
    { key: 'fctSmaValue', label: t('forecast.smaValue') },
    { key: 'fctSiValue', label: t('forecast.siValue') },
    { key: 'fctAdjustedDemand', label: t('forecast.adjustedDemand') },
  ];

  return (
    <div>
      <PageHeader title={t('forecast.title')} breadcrumb={['stock-management', 'forecasts']} />
      <DataTable columns={columns} data={forecasts} isLoading={isLoading} />
    </div>
  );
}
