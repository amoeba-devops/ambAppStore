import { apiClient } from '@/lib/api-client';
import { unwrap, ApiEnvelope } from '@/lib/api-response';
import type { ExternalDataSource } from '@/types/master.types';

export interface CreateDataSourceDto {
  adapter_key: string;
  import_country_code: string;
  display_name: string;
  endpoint_url?: string;
  cache_ttl_sec?: number;
  is_active?: boolean;
  priority?: number;
  config?: Record<string, unknown>;
}

export interface UpdateDataSourceDto {
  display_name?: string;
  endpoint_url?: string;
  cache_ttl_sec?: number;
  is_active?: boolean;
  priority?: number;
  config?: Record<string, unknown>;
}

export const dataSourceService = {
  list: async (importCountry?: string): Promise<ExternalDataSource[]> => {
    const { data } = await apiClient.get<ApiEnvelope<ExternalDataSource[]>>(
      '/v1/external-data-sources',
      { params: importCountry ? { import_country: importCountry } : undefined },
    );
    return unwrap(data);
  },
  create: async (dto: CreateDataSourceDto): Promise<ExternalDataSource> => {
    const { data } = await apiClient.post<ApiEnvelope<ExternalDataSource>>(
      '/v1/external-data-sources',
      dto,
    );
    return unwrap(data);
  },
  update: async (id: string, dto: UpdateDataSourceDto): Promise<ExternalDataSource> => {
    const { data } = await apiClient.patch<ApiEnvelope<ExternalDataSource>>(
      `/v1/external-data-sources/${id}`,
      dto,
    );
    return unwrap(data);
  },
  remove: async (id: string): Promise<void> => {
    const { data } = await apiClient.delete<ApiEnvelope<{ deleted: true }>>(
      `/v1/external-data-sources/${id}`,
    );
    unwrap(data);
  },
};
