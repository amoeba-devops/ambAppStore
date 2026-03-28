import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tripLogApi } from '@/services/api';

export const tripLogKeys = {
  all: ['tripLogs'] as const,
  lists: () => [...tripLogKeys.all, 'list'] as const,
  list: (filters?: Record<string, string>) => [...tripLogKeys.lists(), filters] as const,
  details: () => [...tripLogKeys.all, 'detail'] as const,
  detail: (id: string) => [...tripLogKeys.details(), id] as const,
};

export function useTripLogs(filters?: { vehicle_id?: string; status?: string }) {
  return useQuery({
    queryKey: tripLogKeys.list(filters as Record<string, string>),
    queryFn: () => tripLogApi.getAll(filters),
  });
}

export function useTripLog(id: string) {
  return useQuery({
    queryKey: tripLogKeys.detail(id),
    queryFn: () => tripLogApi.getById(id),
    enabled: !!id,
  });
}

export function useUpdateTripLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      tripLogApi.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: tripLogKeys.lists() });
      qc.invalidateQueries({ queryKey: tripLogKeys.detail(id) });
    },
  });
}

export function useSubmitTripLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      tripLogApi.submit(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: tripLogKeys.all }),
  });
}
