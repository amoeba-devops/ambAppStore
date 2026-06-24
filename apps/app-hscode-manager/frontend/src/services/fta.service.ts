import { apiClient } from '@/lib/api-client';
import { unwrap, ApiEnvelope } from '@/lib/api-response';
import type { FtaMatrixRow, PaginatedResult } from '@/types/master.types';

export interface ListFtaQuery {
  import_country?: string;
  export_country?: string;
  agreement?: string;
  hs_code?: string;
  page?: number;
  page_size?: number;
}

export interface CreateFtaDto {
  import_country_code: string;
  export_country_code: string;
  agreement_code: string;
  hs_code: string;
  rate: string;
  effective_from: string;
  effective_to?: string;
  memo?: string;
}

export interface UpdateFtaDto {
  rate?: string;
  effective_to?: string;
  memo?: string;
}

export const ftaService = {
  list: async (query: ListFtaQuery): Promise<PaginatedResult<FtaMatrixRow>> => {
    const { data } = await apiClient.get<ApiEnvelope<PaginatedResult<FtaMatrixRow>>>(
      '/v1/fta-matrix',
      { params: query },
    );
    return unwrap(data);
  },
  lookup: async (params: {
    import_country: string;
    export_country: string;
    hs_code: string;
  }): Promise<FtaMatrixRow | null> => {
    const { data } = await apiClient.get<ApiEnvelope<FtaMatrixRow | null>>(
      '/v1/fta-matrix/lookup',
      { params },
    );
    return unwrap(data);
  },
  create: async (dto: CreateFtaDto): Promise<FtaMatrixRow> => {
    const { data } = await apiClient.post<ApiEnvelope<FtaMatrixRow>>(
      '/v1/fta-matrix',
      dto,
    );
    return unwrap(data);
  },
  update: async (id: string, dto: UpdateFtaDto): Promise<FtaMatrixRow> => {
    const { data } = await apiClient.patch<ApiEnvelope<FtaMatrixRow>>(
      `/v1/fta-matrix/${id}`,
      dto,
    );
    return unwrap(data);
  },
  remove: async (id: string): Promise<void> => {
    const { data } = await apiClient.delete<ApiEnvelope<{ deleted: true }>>(
      `/v1/fta-matrix/${id}`,
    );
    unwrap(data);
  },
};
