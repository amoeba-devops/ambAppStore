import { useQuery } from '@tanstack/react-query';
import { inventoryApi } from '@/services/api';

export const invKeys = {
  all: ['inventories'] as const,
  list: () => [...invKeys.all, 'list'] as const,
};

export function useInventories() {
  return useQuery({ queryKey: invKeys.list(), queryFn: inventoryApi.getAll });
}
