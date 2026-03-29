import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionApi } from '@/services/api';

export const txnKeys = {
  all: ['transactions'] as const,
  list: () => [...txnKeys.all, 'list'] as const,
};

export function useTransactions() {
  return useQuery({ queryKey: txnKeys.list(), queryFn: transactionApi.getAll });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: transactionApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: txnKeys.list() });
      qc.invalidateQueries({ queryKey: ['inventories'] });
    },
  });
}
