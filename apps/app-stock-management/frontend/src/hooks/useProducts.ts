import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productApi } from '@/services/api';

export const productKeys = {
  all: ['products'] as const,
  list: () => [...productKeys.all, 'list'] as const,
  detail: (id: string) => [...productKeys.all, 'detail', id] as const,
};

export function useProducts() {
  return useQuery({ queryKey: productKeys.list(), queryFn: productApi.getAll });
}

export function useProduct(id: string) {
  return useQuery({ queryKey: productKeys.detail(id), queryFn: () => productApi.getById(id), enabled: !!id });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: productApi.create, onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.list() }) });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => productApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.list() }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: productApi.delete, onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.list() }) });
}
