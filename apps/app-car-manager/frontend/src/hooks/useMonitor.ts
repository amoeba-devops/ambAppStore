import { useQuery } from '@tanstack/react-query';
import { monitorApi } from '@/services/api';

export const monitorKeys = {
  dashboard: ['monitor', 'dashboard'] as const,
  activeDispatches: ['monitor', 'active-dispatches'] as const,
};

export function useDashboard() {
  return useQuery({
    queryKey: monitorKeys.dashboard,
    queryFn: () => monitorApi.getDashboard(),
    refetchInterval: 30 * 1000,
  });
}

export function useActiveDispatches() {
  return useQuery({
    queryKey: monitorKeys.activeDispatches,
    queryFn: () => monitorApi.getActiveDispatches(),
    refetchInterval: 30 * 1000,
  });
}
