import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  integrationApi,
  CreateIntegrationPayload,
  UpdateIntegrationPayload,
  ExternalIntegration,
  ServiceCatalogItem,
} from '@/services/integration.service';

export function useIntegrationList(category?: string) {
  return useQuery<ExternalIntegration[]>({
    queryKey: ['external-integrations', category],
    queryFn: () => integrationApi.list(category).then((r) => r.data.data),
  });
}

export function useServiceCatalog() {
  return useQuery<ServiceCatalogItem[]>({
    queryKey: ['external-integrations', 'catalog'],
    queryFn: () => integrationApi.getCatalog().then((r) => r.data.data),
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateIntegrationPayload) =>
      integrationApi.create(data).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['external-integrations'] }),
  });
}

export function useUpdateIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eitId, data }: { eitId: string; data: UpdateIntegrationPayload }) =>
      integrationApi.update(eitId, data).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['external-integrations'] }),
  });
}

export function useDeleteIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eitId: string) =>
      integrationApi.remove(eitId).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['external-integrations'] }),
  });
}
