import { apiClient } from '@/lib/api-client';

export interface SpuMaster {
  spuId: string;
  spuCode: string;
  brandCode: string;
  subBrandCode: string | null;
  nameKr: string;
  nameEn: string | null;
  nameVi: string | null;
  category: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SkuMaster {
  skuId: string;
  spuId: string;
  wmsCode: string;
  spuCode: string;
  nameKr: string;
  nameEn: string | null;
  nameVi: string | null;
  variant: string | null;
  syncCode: string | null;
  gtinCode: string | null;
  hsCode: string | null;
  primeCost: number;
  supplyPrice: number;
  listingPrice: number;
  sellingPrice: number;
  fulfillmentFeeOverride: number | null;
  weight: number | null;
  unit: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  spu?: SpuMaster;
}

export interface ChannelMaster {
  chnCode: string;
  chnName: string;
  chnType: string;
  platformFeeRate: number | null;
  paymentFeeRate: number | null;
  isActive: boolean;
}

export interface ChannelProductMapping {
  cpmId: string;
  skuId: string;
  wmsCode: string;
  skuNameKr: string;
  chnCode: string;
  channelProductId: string | null;
  channelVariationId: string | null;
  channelNameVi: string | null;
  listingPrice: number | null;
  sellingPrice: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SkuCostHistory {
  schId: string;
  skuId: string;
  primeCost: number;
  supplyPrice: number;
  listingPrice: number;
  sellingPrice: number;
  effectiveDate: string;
  memo: string | null;
  createdBy: string | null;
  createdAt: string;
}

// SPU API
export const spuApi = {
  list: (search?: string) => apiClient.get('/v1/spu-masters', { params: { search } }),
  get: (id: string) => apiClient.get(`/v1/spu-masters/${id}`),
  create: (data: any) => apiClient.post('/v1/spu-masters', data),
  update: (id: string, data: any) => apiClient.patch(`/v1/spu-masters/${id}`, data),
  delete: (id: string) => apiClient.delete(`/v1/spu-masters/${id}`),
};

// SKU API
export const skuApi = {
  list: (params?: { search?: string; spu_code?: string }) =>
    apiClient.get('/v1/sku-masters', { params }),
  get: (id: string) => apiClient.get(`/v1/sku-masters/${id}`),
  create: (data: any) => apiClient.post('/v1/sku-masters', data),
  update: (id: string, data: any) => apiClient.patch(`/v1/sku-masters/${id}`, data),
  delete: (id: string) => apiClient.delete(`/v1/sku-masters/${id}`),
};

// Channel Master API
export const channelApi = {
  list: () => apiClient.get('/v1/channel-masters'),
};

// Channel Product Mapping API
export const channelMappingApi = {
  list: (params?: { chn_code?: string; search?: string }) =>
    apiClient.get('/v1/channel-product-mappings', { params }),
  create: (data: any) => apiClient.post('/v1/channel-product-mappings', data),
  update: (id: string, data: any) => apiClient.patch(`/v1/channel-product-mappings/${id}`, data),
  delete: (id: string) => apiClient.delete(`/v1/channel-product-mappings/${id}`),
};

// SKU Cost History API
export const costHistoryApi = {
  listBySkuId: (skuId: string) => apiClient.get(`/v1/sku-cost-histories/${skuId}`),
};
