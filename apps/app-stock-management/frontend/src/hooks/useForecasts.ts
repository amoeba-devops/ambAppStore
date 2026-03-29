import { useQuery } from '@tanstack/react-query';
import { forecastApi } from '@/services/api';

export function useForecasts() {
  return useQuery({ queryKey: ['forecasts', 'list'], queryFn: forecastApi.getAll });
}
