import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface AdminIntegration {
  peiId: string;
  entId: string;
  category: string;
  serviceCode: string;
  serviceName: string;
  endpoint: string | null;
  keyName: string | null;
  hasKeyValue: boolean;
  extraConfig: Record<string, unknown> | null;
  isActive: boolean;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceCatalogItem {
  category: string;
  serviceCode: string;
  serviceName: string;
  defaultEndpoint: string | null;
  defaultKeyName: string | null;
}

export function useAdminIntegrations(category?: string) {
  return useQuery<AdminIntegration[]>({
    queryKey: ['admin', 'integrations', category],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (category) params.category = category;
      const res = await apiClient.get('/v1/admin/integrations', { params });
      return res.data.data;
    },
  });
}

export function useServiceCatalog() {
  return useQuery<ServiceCatalogItem[]>({
    queryKey: ['admin', 'integrations', 'catalog'],
    queryFn: async () => {
      const res = await apiClient.get('/v1/admin/integrations/catalog');
      return res.data.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateAdminIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiClient.post('/v1/admin/integrations', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'integrations'] });
    },
  });
}

export function useUpdateAdminIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ peiId, data }: { peiId: string; data: Record<string, unknown> }) => {
      const res = await apiClient.patch(`/v1/admin/integrations/${peiId}`, data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'integrations'] });
    },
  });
}

export function useDeleteAdminIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (peiId: string) => {
      const res = await apiClient.delete(`/v1/admin/integrations/${peiId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'integrations'] });
    },
  });
}
