import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dispatchApi } from '@/services/api';

export const dispatchKeys = {
  all: ['dispatches'] as const,
  lists: () => [...dispatchKeys.all, 'list'] as const,
  list: (filters?: Record<string, string>) => [...dispatchKeys.lists(), filters] as const,
  details: () => [...dispatchKeys.all, 'detail'] as const,
  detail: (id: string) => [...dispatchKeys.details(), id] as const,
};

export function useDispatches(filters?: { status?: string; vehicle_id?: string; driver_id?: string }, enabled = true) {
  return useQuery({
    queryKey: dispatchKeys.list(filters as Record<string, string>),
    queryFn: () => dispatchApi.getAll(filters),
    enabled,
  });
}

export function useDispatch(id: string) {
  return useQuery({
    queryKey: dispatchKeys.detail(id),
    queryFn: () => dispatchApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateDispatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => dispatchApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: dispatchKeys.lists() }),
  });
}

export function useUpdateDispatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      dispatchApi.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: dispatchKeys.detail(id) });
      qc.invalidateQueries({ queryKey: dispatchKeys.lists() });
    },
  });
}

export function useApproveDispatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { vehicle_id: string; driver_id?: string } }) =>
      dispatchApi.approve(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dispatchKeys.all });
    },
  });
}

export function useRejectDispatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      dispatchApi.reject(id, { reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: dispatchKeys.all }),
  });
}

export function useDispatchAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, data }: { id: string; action: string; data?: Record<string, unknown> }) => {
      switch (action) {
        case 'depart': return dispatchApi.depart(id);
        case 'arrive': return dispatchApi.arrive(id);
        case 'complete': return dispatchApi.complete(id);
        case 'cancel': return dispatchApi.cancel(id, data as { reason: string });
        case 'driver-respond': return dispatchApi.driverRespond(id, data as { accepted: boolean; reject_reason?: string });
        default: throw new Error(`Unknown action: ${action}`);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: dispatchKeys.all }),
  });
}
