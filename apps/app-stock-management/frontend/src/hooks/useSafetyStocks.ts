import { useQuery } from '@tanstack/react-query';
import { safetyStockApi } from '@/services/api';

export function useSafetyStocks() {
  return useQuery({ queryKey: ['safety-stocks', 'list'], queryFn: safetyStockApi.getAll });
}
