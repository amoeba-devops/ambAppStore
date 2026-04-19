import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { maintenanceApi } from '@/services/api';

export const maintenanceKeys = {
  all: ['maintenance'] as const,
  lists: () => [...maintenanceKeys.all, 'list'] as const,
  list: (filters?: Record<string, string>) => [...maintenanceKeys.lists(), filters] as const,
  details: () => [...maintenanceKeys.all, 'detail'] as const,
  detail: (id: string) => [...maintenanceKeys.details(), id] as const,
};

export function useMaintenanceRecords(filters?: { vehicle_id?: string; type?: string }) {
  return useQuery({
    queryKey: maintenanceKeys.list(filters as Record<string, string>),
    queryFn: () => maintenanceApi.getAll(filters),
  });
}

export function useMaintenanceRecord(id: string) {
  return useQuery({
    queryKey: maintenanceKeys.detail(id),
    queryFn: () => maintenanceApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateMaintenance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => maintenanceApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.lists() });
    },
  });
}

export function useUpdateMaintenance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      maintenanceApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.lists() });
    },
  });
}

export function useDeleteMaintenance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => maintenanceApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.lists() });
    },
  });
}
