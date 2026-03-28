import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { driverApi } from '@/services/api';

export const driverKeys = {
  all: ['drivers'] as const,
  lists: () => [...driverKeys.all, 'list'] as const,
  list: (filters?: Record<string, string>) => [...driverKeys.lists(), filters] as const,
  available: () => [...driverKeys.all, 'available'] as const,
  details: () => [...driverKeys.all, 'detail'] as const,
  detail: (id: string) => [...driverKeys.details(), id] as const,
};

export function useDrivers(filters?: { vehicle_id?: string; status?: string }) {
  return useQuery({
    queryKey: driverKeys.list(filters as Record<string, string>),
    queryFn: () => driverApi.getAll(filters),
  });
}

export function useAvailableDrivers() {
  return useQuery({
    queryKey: driverKeys.available(),
    queryFn: () => driverApi.getAvailable(),
  });
}

export function useDriver(id: string) {
  return useQuery({
    queryKey: driverKeys.detail(id),
    queryFn: () => driverApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateDriver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => driverApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: driverKeys.lists() }),
  });
}

export function useUpdateDriver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      driverApi.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: driverKeys.lists() });
      qc.invalidateQueries({ queryKey: driverKeys.detail(id) });
    },
  });
}

export function useDeleteDriver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => driverApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: driverKeys.lists() }),
  });
}
