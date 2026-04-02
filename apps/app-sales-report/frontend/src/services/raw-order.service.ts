import { apiClient } from '@/lib/api-client';

export interface RawOrderListItem {
  ordId: string;
  channelOrderId: string;
  channel: string;
  orderDate: string;
  status: string;
  totalVnd: number;
  totalBuyerPayment: number;
  trackingNo: string | null;
  itemCount: number;
  totalQty: number;
  skuMatchRate: number;
}

export interface RawOrderDetail {
  ordId: string;
  ordChannelOrderId: string;
  chnCode: string;
  ordOrderDate: string;
  ordStatus: string;
  ordStatusRaw: string | null;
  ordTrackingNo: string | null;
  ordCarrier: string | null;
  ordTotalVnd: string | null;
  ordTotalBuyerPayment: string | null;
  ordCommissionFee: string | null;
  ordServiceFee: string | null;
  ordPaymentFee: string | null;
  ordShippingFeeEst: string | null;
  ordProvince: string | null;
  ordPaymentMethod: string | null;
  ordImportBatchId: string | null;
  items: RawOrderDetailItem[];
}

export interface RawOrderDetailItem {
  oliId: string;
  productSku: string | null;
  productName: string | null;
  variantSku: string | null;
  variantName: string | null;
  quantity: number;
  originalPrice: number | null;
  dealPrice: number | null;
  buyerPaid: number | null;
  skuMatchStatus: string;
  returnStatus: string | null;
  returnQuantity: number;
}

export interface PaginationMeta {
  page: number;
  size: number;
  totalCount: number;
  totalPages: number;
}

export const rawOrderApi = {
  list: (params?: Record<string, string | number | undefined>) =>
    apiClient.get<{
      success: boolean;
      data: RawOrderListItem[];
      pagination: PaginationMeta;
    }>('/v1/raw-orders/list', { params }),

  detail: (ordId: string) =>
    apiClient.get<{ success: boolean; data: RawOrderDetail }>(`/v1/raw-orders/${ordId}`),
};
