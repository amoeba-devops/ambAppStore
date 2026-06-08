import { apiClient } from '@/lib/api-client';
import { unwrap, ApiEnvelope } from '@/lib/api-response';
import type { Exporter, PaginatedResult } from '@/types/master.types';

export interface CreateExporterDto {
  name: string;
  country_code: string;
  aliases?: string[];
  risk_flags?: Record<string, unknown>;
  memo?: string;
}

export interface UpdateExporterDto extends Partial<CreateExporterDto> {}

export interface ListExportersQuery {
  q?: string;
  country_code?: string;
  page?: number;
  page_size?: number;
}

export const exporterService = {
  list: async (query: ListExportersQuery): Promise<PaginatedResult<Exporter>> => {
    const { data } = await apiClient.get<ApiEnvelope<PaginatedResult<Exporter>>>(
      '/v1/exporters',
      { params: query },
    );
    return unwrap(data);
  },
  create: async (dto: CreateExporterDto): Promise<Exporter> => {
    const { data } = await apiClient.post<ApiEnvelope<Exporter>>('/v1/exporters', dto);
    return unwrap(data);
  },
  update: async (id: string, dto: UpdateExporterDto): Promise<Exporter> => {
    const { data } = await apiClient.patch<ApiEnvelope<Exporter>>(
      `/v1/exporters/${id}`,
      dto,
    );
    return unwrap(data);
  },
  remove: async (id: string): Promise<void> => {
    const { data } = await apiClient.delete<ApiEnvelope<{ deleted: true }>>(
      `/v1/exporters/${id}`,
    );
    unwrap(data);
  },
};
