import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesOrderApi } from '@/services/api';

export const sodKeys = {
  all: ['sales-orders'] as const,
  list: () => [...sodKeys.all, 'list'] as const,
  detail: (id: string) => [...sodKeys.all, 'detail', id] as const,
};

export function useSalesOrders() {
  return useQuery({ queryKey: sodKeys.list(), queryFn: salesOrderApi.getAll });
}

export function useSalesOrder(id: string) {
  return useQuery({ queryKey: sodKeys.detail(id), queryFn: () => salesOrderApi.getById(id), enabled: !!id });
}

export function useCreateSalesOrder() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: salesOrderApi.create, onSuccess: () => qc.invalidateQueries({ queryKey: sodKeys.list() }) });
}

export function useConfirmSalesOrder() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: salesOrderApi.confirm, onSuccess: () => qc.invalidateQueries({ queryKey: sodKeys.all }) });
}

export function useShipSalesOrder() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: salesOrderApi.ship, onSuccess: () => qc.invalidateQueries({ queryKey: sodKeys.all }) });
}

export function useCancelSalesOrder() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: salesOrderApi.cancel, onSuccess: () => qc.invalidateQueries({ queryKey: sodKeys.all }) });
}
