import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { spuApi, skuApi, channelApi, channelMappingApi, costHistoryApi } from '@/services/sales.service';

// SPU Hooks
export function useSpuList(search?: string) {
  return useQuery({
    queryKey: ['spu-masters', search],
    queryFn: () => spuApi.list(search).then((r) => r.data.data),
  });
}

export function useSpuDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['spu-masters', id],
    queryFn: () => spuApi.get(id!).then((r) => r.data.data),
    enabled: !!id,
  });
}

export function useCreateSpu() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => spuApi.create(data).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['spu-masters'] }),
  });
}

export function useUpdateSpu() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => spuApi.update(id, data).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['spu-masters'] }),
  });
}

export function useDeleteSpu() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => spuApi.delete(id).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['spu-masters'] }),
  });
}

// SKU Hooks
export function useSkuList(params?: { search?: string; spu_code?: string }) {
  return useQuery({
    queryKey: ['sku-masters', params],
    queryFn: () => skuApi.list(params).then((r) => r.data.data),
  });
}

export function useSkuDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['sku-masters', id],
    queryFn: () => skuApi.get(id!).then((r) => r.data.data),
    enabled: !!id,
  });
}

export function useCreateSku() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => skuApi.create(data).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sku-masters'] }),
  });
}

export function useUpdateSku() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => skuApi.update(id, data).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sku-masters'] });
      qc.invalidateQueries({ queryKey: ['sku-cost-histories'] });
    },
  });
}

export function useDeleteSku() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => skuApi.delete(id).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sku-masters'] }),
  });
}

// Channel Hooks
export function useChannelList() {
  return useQuery({
    queryKey: ['channel-masters'],
    queryFn: () => channelApi.list().then((r) => r.data.data),
    staleTime: 5 * 60 * 1000, // 5min (channels rarely change)
  });
}

// Channel Mapping Hooks
export function useChannelMappingList(params?: { chn_code?: string; search?: string }) {
  return useQuery({
    queryKey: ['channel-mappings', params],
    queryFn: () => channelMappingApi.list(params).then((r) => r.data.data),
  });
}

export function useCreateChannelMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => channelMappingApi.create(data).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channel-mappings'] }),
  });
}

export function useUpdateChannelMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => channelMappingApi.update(id, data).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channel-mappings'] }),
  });
}

export function useDeleteChannelMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => channelMappingApi.delete(id).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channel-mappings'] }),
  });
}

// Cost History Hooks
export function useSkuCostHistory(skuId: string | undefined) {
  return useQuery({
    queryKey: ['sku-cost-histories', skuId],
    queryFn: () => costHistoryApi.listBySkuId(skuId!).then((r) => r.data.data),
    enabled: !!skuId,
  });
}
