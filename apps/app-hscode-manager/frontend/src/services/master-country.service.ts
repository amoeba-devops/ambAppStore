import { apiClient } from '@/lib/api-client';
import { unwrap, ApiEnvelope } from '@/lib/api-response';
import type {
  ImportCountry,
  ExportCountry,
  SupportStatus,
} from '@/types/master.types';

export interface CreateImportCountryDto {
  code: string;
  name_ko: string;
  name_en: string;
  name_vi: string;
  support_status?: SupportStatus;
  adapter_key?: string;
  currency_code?: string;
  default_tariff_currency?: string;
}

export interface UpdateImportCountryStatusDto {
  support_status: SupportStatus;
  adapter_key?: string;
}

export interface CreateExportCountryDto {
  code: string;
  name_ko: string;
  name_en: string;
  name_vi: string;
  is_active?: boolean;
}

export interface UpdateExportCountryDto {
  name_ko?: string;
  name_en?: string;
  name_vi?: string;
  is_active?: boolean;
}

export const importCountryService = {
  list: async (): Promise<ImportCountry[]> => {
    const { data } = await apiClient.get<ApiEnvelope<ImportCountry[]>>(
      '/v1/import-countries',
    );
    return unwrap(data);
  },
  create: async (dto: CreateImportCountryDto): Promise<ImportCountry> => {
    const { data } = await apiClient.post<ApiEnvelope<ImportCountry>>(
      '/v1/import-countries',
      dto,
    );
    return unwrap(data);
  },
  updateStatus: async (
    id: string,
    dto: UpdateImportCountryStatusDto,
  ): Promise<ImportCountry> => {
    const { data } = await apiClient.patch<ApiEnvelope<ImportCountry>>(
      `/v1/import-countries/${id}/status`,
      dto,
    );
    return unwrap(data);
  },
  remove: async (id: string): Promise<void> => {
    const { data } = await apiClient.delete<ApiEnvelope<{ deleted: true }>>(
      `/v1/import-countries/${id}`,
    );
    unwrap(data);
  },
};

export const exportCountryService = {
  list: async (): Promise<ExportCountry[]> => {
    const { data } = await apiClient.get<ApiEnvelope<ExportCountry[]>>(
      '/v1/export-countries',
    );
    return unwrap(data);
  },
  create: async (dto: CreateExportCountryDto): Promise<ExportCountry> => {
    const { data } = await apiClient.post<ApiEnvelope<ExportCountry>>(
      '/v1/export-countries',
      dto,
    );
    return unwrap(data);
  },
  update: async (id: string, dto: UpdateExportCountryDto): Promise<ExportCountry> => {
    const { data } = await apiClient.patch<ApiEnvelope<ExportCountry>>(
      `/v1/export-countries/${id}`,
      dto,
    );
    return unwrap(data);
  },
  remove: async (id: string): Promise<void> => {
    const { data } = await apiClient.delete<ApiEnvelope<{ deleted: true }>>(
      `/v1/export-countries/${id}`,
    );
    unwrap(data);
  },
};
