import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orderBatchApi } from '@/services/api';

export const obtKeys = {
  all: ['order-batches'] as const,
  list: () => [...obtKeys.all, 'list'] as const,
};

export function useOrderBatches() {
  return useQuery({ queryKey: obtKeys.list(), queryFn: orderBatchApi.getAll });
}

export function useAdjustBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, qty }: { id: string; qty: number }) => orderBatchApi.adjust(id, qty),
    onSuccess: () => qc.invalidateQueries({ queryKey: obtKeys.list() }),
  });
}

export function useApproveBatch() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: orderBatchApi.approve, onSuccess: () => qc.invalidateQueries({ queryKey: obtKeys.list() }) });
}

export function useConfirmBatch() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: orderBatchApi.confirm, onSuccess: () => qc.invalidateQueries({ queryKey: obtKeys.list() }) });
}
