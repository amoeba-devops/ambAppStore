import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Barcode, Pencil } from 'lucide-react';
import { useSkuDetail } from '@/hooks/useSales';

export function SkuDetailPage() {
  const { t } = useTranslation('sales');
  const navigate = useNavigate();
  const { skuId } = useParams<{ skuId: string }>();
  const { data: sku, isLoading } = useSkuDetail(skuId);

  const formatPrice = (n: number | null | undefined) => {
    if (n == null) return '-';
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(n);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
      </div>
    );
  }

  if (!sku) {
    return <div className="py-20 text-center text-gray-400">{t('common.noData')}</div>;
  }

  return (
    <div>
      <button
        onClick={() => navigate('/sku')}
        className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('sku.backToList')}
      </button>

      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Barcode className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">{t('sku.detailTitle')}</h1>
          <span className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
            sku.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {sku.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        <button
          onClick={() => navigate('/sku', { state: { editSkuId: sku.skuId } })}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <Pencil className="h-4 w-4" />
          {t('common.edit')}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 상품명 */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">{t('sku.sectionName')}</h2>
          <dl className="space-y-2">
            <div className="flex items-start justify-between text-sm">
              <dt className="w-20 shrink-0 text-gray-500">🇰🇷 KR</dt>
              <dd className="flex-1 text-right text-gray-900">{sku.nameKr}</dd>
            </div>
            <div className="flex items-start justify-between text-sm">
              <dt className="w-20 shrink-0 text-gray-500">🇺🇸 EN</dt>
              <dd className="flex-1 text-right text-gray-900">{sku.nameEn || '-'}</dd>
            </div>
            <div className="flex items-start justify-between text-sm">
              <dt className="w-20 shrink-0 text-gray-500">🇻🇳 VI</dt>
              <dd className="flex-1 text-right text-gray-900">{sku.nameVi || '-'}</dd>
            </div>
          </dl>
        </div>

        {/* 코드 정보 */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">{t('sku.sectionCode')}</h2>
          <dl className="space-y-2">
            {[
              { label: t('sku.wmsCode'), value: sku.wmsCode },
              { label: t('sku.spuCode'), value: sku.spuCode },
              { label: t('sku.gtinCode'), value: sku.gtinCode },
              { label: t('sku.syncCode'), value: sku.syncCode },
              { label: t('sku.hsCode'), value: sku.hsCode },
            ].map((row, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <dt className="text-gray-500">{row.label}</dt>
                <dd className="font-mono text-xs text-gray-900">{row.value || '-'}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* 가격 정보 */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">{t('sku.sectionPrice')}</h2>
          <dl className="space-y-2">
            {[
              { label: t('sku.primeCost'), value: formatPrice(sku.primeCost) },
              { label: t('sku.supplyPrice'), value: formatPrice(sku.supplyPrice) },
              { label: t('sku.listingPrice'), value: formatPrice(sku.listingPrice) },
              { label: t('sku.sellingPrice'), value: formatPrice(sku.sellingPrice) },
              { label: t('sku.fulfillmentFee'), value: formatPrice(sku.fulfillmentFeeOverride) },
            ].map((row, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <dt className="text-gray-500">{row.label}</dt>
                <dd className="font-mono text-gray-900">{row.value}</dd>
              </div>
            ))}
            {sku.costUpdatedAt && (
              <div className="flex items-center justify-between text-sm">
                <dt className="text-gray-500">{t('sku.costUpdatedAt')}</dt>
                <dd className="text-xs text-gray-500">{new Date(sku.costUpdatedAt).toLocaleDateString()}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* 상품 속성 */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">{t('sku.sectionAttribute')}</h2>
          <dl className="space-y-2">
            {[
              { label: t('sku.variantType'), value: sku.variantType },
              { label: t('sku.variantValue'), value: sku.variantValue },
              { label: t('sku.color'), value: sku.color },
              { label: t('sku.weight'), value: sku.weightGram ? `${sku.weightGram}g` : null },
              { label: t('sku.unit'), value: sku.unit },
            ].map((row, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <dt className="text-gray-500">{row.label}</dt>
                <dd className="text-gray-900">{row.value || '-'}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* 상품 설명 */}
      {sku.description && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">{t('sku.description')}</h2>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{sku.description}</p>
        </div>
      )}

      {/* 메타 정보 */}
      <div className="mt-4 flex items-center gap-6 text-xs text-gray-400">
        <span>{t('sku.createdAt')}: {new Date(sku.createdAt).toLocaleString()}</span>
        <span>{t('sku.updatedAt')}: {new Date(sku.updatedAt).toLocaleString()}</span>
      </div>
    </div>
  );
}
