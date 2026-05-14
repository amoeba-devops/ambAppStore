import { apiClient } from '@/lib/api-client';
import { unwrap, ApiEnvelope } from '@/lib/api-response';
import type {
  CategorySchema,
  ExcelPreview,
  ExcelImportResult,
  ExcelBatch,
  HoldRow,
  Item,
  ItemCategory,
} from '@/types/inquiry.types';

export interface DirectIntakeDto {
  inquiry_id: string;
  name: string;
  category: ItemCategory;
  usage_description?: string;
  spec_attributes?: Record<string, unknown>;
  gtin?: string;
  attachment_count?: number;
  force_proceed?: boolean;
  force_proceed_reason?: string;
}

export interface ExcelImportPayload {
  inquiry_id: string;
  sheet: string;
  header_row: number;
  category?: ItemCategory;
  mapping: Record<string, string | null>;
  profile_name?: string;
  exporter_id?: string;
}

export const intakeService = {
  getCategorySchema: async (category?: ItemCategory): Promise<CategorySchema | CategorySchema[]> => {
    const { data } = await apiClient.get<ApiEnvelope<CategorySchema | CategorySchema[]>>(
      '/v1/intake/category-schema',
      { params: category ? { category } : undefined },
    );
    return unwrap(data);
  },

  direct: async (
    dto: DirectIntakeDto,
  ): Promise<{ item: Item; completenessScore: number }> => {
    const { data } = await apiClient.post<
      ApiEnvelope<{ item: Item; completenessScore: number }>
    >('/v1/intake/direct', dto);
    return unwrap(data);
  },

  excelPreview: async (file: File, sheet?: string): Promise<ExcelPreview> => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await apiClient.post<ApiEnvelope<ExcelPreview>>(
      '/v1/intake/excel/preview',
      form,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        params: sheet ? { sheet } : undefined,
      },
    );
    return unwrap(data);
  },

  excelImport: async (
    file: File,
    payload: ExcelImportPayload,
  ): Promise<ExcelImportResult> => {
    const form = new FormData();
    form.append('file', file);
    form.append('payload', JSON.stringify(payload));
    const { data } = await apiClient.post<ApiEnvelope<ExcelImportResult>>(
      '/v1/intake/excel/import',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return unwrap(data);
  },

  listBatches: async (inquiryId: string): Promise<ExcelBatch[]> => {
    const { data } = await apiClient.get<ApiEnvelope<ExcelBatch[]>>(
      '/v1/intake/excel/batches',
      { params: { inquiry_id: inquiryId } },
    );
    return unwrap(data);
  },

  listHoldRows: async (batchId: string): Promise<HoldRow[]> => {
    const { data } = await apiClient.get<ApiEnvelope<HoldRow[]>>(
      `/v1/intake/excel/batches/${batchId}/hold`,
    );
    return unwrap(data);
  },

  updateHold: async (
    holdId: string,
    rawData: Record<string, unknown>,
  ): Promise<{ id: string; resolvedAt: string | null }> => {
    const { data } = await apiClient.patch<
      ApiEnvelope<{ id: string; resolvedAt: string | null }>
    >(`/v1/intake/excel/hold/${holdId}`, { raw_data: rawData });
    return unwrap(data);
  },

  listItemsByInquiry: async (inquiryId: string): Promise<Item[]> => {
    const { data } = await apiClient.get<ApiEnvelope<Item[]>>('/v1/items', {
      params: { inquiry_id: inquiryId },
    });
    return unwrap(data);
  },
};
