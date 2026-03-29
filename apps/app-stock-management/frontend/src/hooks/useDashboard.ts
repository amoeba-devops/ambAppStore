import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/services/api';

export function useDashboardSummary() {
  return useQuery({ queryKey: ['dashboard', 'summary'], queryFn: dashboardApi.summary });
}

export function useStockRisk() {
  return useQuery({ queryKey: ['dashboard', 'stock-risk'], queryFn: dashboardApi.stockRisk });
}

export function useTrend() {
  return useQuery({ queryKey: ['dashboard', 'trend'], queryFn: dashboardApi.trend });
}
