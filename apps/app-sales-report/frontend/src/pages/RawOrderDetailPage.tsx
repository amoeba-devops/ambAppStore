import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ShoppingCart, Package } from 'lucide-react';
import { useRawOrderDetail } from '@/hooks/useRawOrders';

export function RawOrderDetailPage() {
  const { t } = useTranslation('sales');
  const navigate = useNavigate();
  const { ordId } = useParams<{ ordId: string }>();
  const { data: order, isLoading } = useRawOrderDetail(ordId ?? '');

  const formatVnd = (v: string | number | null | undefined) => {
    if (v == null) return '-';
    return new Intl.NumberFormat('vi-VN').format(Number(v));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="py-20 text-center text-gray-400">{t('common.noData')}</div>
    );
  }

  const infoRows: { label: string; value: React.ReactNode }[] = [
    { label: t('order.orderId'), value: <span className="font-mono text-xs">{order.ordChannelOrderId}</span> },
    { label: t('order.channel'), value: (
      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${order.chnCode === 'SHOPEE' ? 'bg-orange-100 text-orange-700' : 'bg-black text-white'}`}>
        {order.chnCode}
      </span>
    )},
    { label: t('order.date'), value: order.ordOrderDate ? new Date(order.ordOrderDate).toLocaleDateString() : '-' },
    { label: t('order.status'), value: (
      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        order.ordStatus === 'COMPLETED' ? 'bg-green-100 text-green-700' :
        order.ordStatus === 'CANCELLED' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
      }`}>
        {order.ordStatus}
      </span>
    )},
    { label: t('order.province'), value: order.ordProvince || '-' },
    { label: t('order.trackingNo'), value: order.ordTrackingNo || '-' },
    { label: t('order.carrier'), value: order.ordCarrier || '-' },
    { label: t('order.paymentMethod'), value: order.ordPaymentMethod || '-' },
  ];

  const financeRows: { label: string; value: string }[] = [
    { label: t('order.totalVnd'), value: formatVnd(order.ordTotalVnd) },
    { label: t('order.buyerPayment'), value: formatVnd(order.ordTotalBuyerPayment) },
    { label: t('order.commissionFee'), value: formatVnd(order.ordCommissionFee) },
    { label: t('order.serviceFee'), value: formatVnd(order.ordServiceFee) },
    { label: t('order.paymentFee'), value: formatVnd(order.ordPaymentFee) },
    { label: t('order.shippingFee'), value: formatVnd(order.ordShippingFeeEst) },
  ];

  return (
    <div>
      <button
        onClick={() => navigate('/orders')}
        className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('order.backToList')}
      </button>

      <div className="mb-6 flex items-center gap-2">
        <ShoppingCart className="h-5 w-5 text-blue-600" />
        <h1 className="text-xl font-bold text-gray-900">{t('order.detail')}</h1>
      </div>

      {/* Order Info + Finance */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">{t('order.orderInfo')}</h2>
          <dl className="space-y-2">
            {infoRows.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <dt className="text-gray-500">{r.label}</dt>
                <dd className="text-gray-900">{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">{t('order.finance')}</h2>
          <dl className="space-y-2">
            {financeRows.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <dt className="text-gray-500">{r.label}</dt>
                <dd className="font-mono text-gray-900">{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Items Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Package className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700">{t('order.items')} ({order.items.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t('order.productName')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t('order.variant')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">SKU</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">{t('order.qty')}</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">{t('order.originalPrice')}</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">{t('order.dealPrice')}</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">{t('order.buyerPaid')}</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">{t('order.skuMatch')}</th>
              </tr>
            </thead>
            <tbody>
              {order.items.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">{t('order.noItems')}</td></tr>
              ) : (
                order.items.map((item) => (
                  <tr key={item.oliId} className="border-b border-gray-100">
                    <td className="max-w-[200px] truncate px-4 py-3 text-xs">{item.productName || '-'}</td>
                    <td className="max-w-[150px] truncate px-4 py-3 text-xs">{item.variantName || '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{item.variantSku || item.productSku || '-'}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{item.quantity}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{formatVnd(item.originalPrice)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{formatVnd(item.dealPrice)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{formatVnd(item.buyerPaid)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.skuMatchStatus === 'MATCHED' ? 'bg-green-100 text-green-700' :
                        item.skuMatchStatus === 'UNMATCHED' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {item.skuMatchStatus}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
