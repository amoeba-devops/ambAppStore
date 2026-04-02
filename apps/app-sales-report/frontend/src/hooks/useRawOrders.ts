import { useQuery } from '@tanstack/react-query';
import { rawOrderApi } from '@/services/raw-order.service';

export function useRawOrderList(params?: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: ['raw-orders', params],
    queryFn: () => rawOrderApi.list(params).then((r) => ({
      data: r.data.data,
      pagination: r.data.pagination,
    })),
  });
}

export function useRawOrderDetail(ordId: string | undefined) {
  return useQuery({
    queryKey: ['raw-orders', ordId],
    queryFn: () => rawOrderApi.detail(ordId!).then((r) => r.data.data),
    enabled: !!ordId,
  });
}
