import { useQuery } from '@tanstack/react-query';
import { amaApi } from '@/services/api';

export function useAmaMembers(search: string) {
  return useQuery({
    queryKey: ['ama', 'members', search],
    queryFn: () => amaApi.getMembers({ search }),
    enabled: search.length >= 2,
    staleTime: 60 * 1000,
  });
}
