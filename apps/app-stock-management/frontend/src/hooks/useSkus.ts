import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { skuApi } from '@/services/api';

export const skuKeys = {
  all: ['skus'] as const,
  list: (search?: string) => [...skuKeys.all, 'list', search] as const,
  detail: (id: string) => [...skuKeys.all, 'detail', id] as const,
};

export function useSkus(search?: string) {
  return useQuery({ queryKey: skuKeys.list(search), queryFn: () => skuApi.getAll(search) });
}

export function useSku(id: string) {
  return useQuery({ queryKey: skuKeys.detail(id), queryFn: () => skuApi.getById(id), enabled: !!id });
}

export function useCreateSku() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: skuApi.create, onSuccess: () => qc.invalidateQueries({ queryKey: skuKeys.list() }) });
}

export function useUpdateSku() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => skuApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: skuKeys.list() }),
  });
}

export function useChangeSkuStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => skuApi.changeStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: skuKeys.all }),
  });
}
