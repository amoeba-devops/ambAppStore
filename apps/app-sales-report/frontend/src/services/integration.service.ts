import { apiClient } from '@/lib/api-client';

export interface ExternalIntegration {
  eitId: string;
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

export interface CreateIntegrationPayload {
  category: string;
  service_code: string;
  service_name: string;
  endpoint?: string;
  key_name?: string;
  key_value?: string;
  extra_config?: Record<string, unknown>;
  is_active?: boolean;
}

export interface UpdateIntegrationPayload {
  category?: string;
  service_code?: string;
  service_name?: string;
  endpoint?: string;
  key_name?: string;
  key_value?: string;
  extra_config?: Record<string, unknown>;
  is_active?: boolean;
}

export const integrationApi = {
  list: (category?: string) =>
    apiClient.get('/v1/external-integrations', { params: category ? { category } : {} }),
  getCatalog: () =>
    apiClient.get('/v1/external-integrations/catalog'),
  create: (data: CreateIntegrationPayload) =>
    apiClient.post('/v1/external-integrations', data),
  update: (eitId: string, data: UpdateIntegrationPayload) =>
    apiClient.patch(`/v1/external-integrations/${eitId}`, data),
  remove: (eitId: string) =>
    apiClient.delete(`/v1/external-integrations/${eitId}`),
};
