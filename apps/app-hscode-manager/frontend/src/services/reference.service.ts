import { apiClient, ApiResponse, unwrap } from '@/lib/api-client';
import type {
  CountryExtension,
  ImportBatch,
  Paginated,
  ReviewItem,
} from '@/types/admin.types';

export const referenceService = {
  // --- import (RAG 코퍼스) ---
  listImports(): Promise<Paginated<ImportBatch>> {
    return unwrap(apiClient.get<ApiResponse<Paginated<ImportBatch>>>('/reference/imports'));
  },
  uploadImport(file: File, sourceCompany?: string): Promise<ImportBatch> {
    const fd = new FormData();
    fd.append('file', file);
    if (sourceCompany) fd.append('source_company', sourceCompany);
    return unwrap(
      apiClient.post<ApiResponse<ImportBatch>>('/reference/imports', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
  },

  // --- review queue ---
  listReview(): Promise<Paginated<ReviewItem>> {
    return unwrap(
      apiClient.get<ApiResponse<Paginated<ReviewItem>>>('/reference/review-queue'),
    );
  },
  approveReview(id: string, hsCode: string, hs6: string): Promise<ReviewItem> {
    return unwrap(
      apiClient.post<ApiResponse<ReviewItem>>(`/reference/review-queue/${id}/approve`, {
        hs_code: hsCode,
        hs6,
      }),
    );
  },
  assignReview(id: string, assignedTo: string): Promise<ReviewItem> {
    return unwrap(
      apiClient.post<ApiResponse<ReviewItem>>(`/reference/review-queue/${id}/assign`, {
        assigned_to: assignedTo,
      }),
    );
  },

  // --- mapping ---
  upsertCountryExt(payload: {
    hs6: string;
    country: string;
    hs_full: string;
    duty_rate?: number;
  }): Promise<unknown> {
    return unwrap(apiClient.post<ApiResponse<unknown>>('/reference/maps/country-ext', payload));
  },
  preview(hs6: string): Promise<CountryExtension[]> {
    return unwrap(
      apiClient.get<ApiResponse<CountryExtension[]>>('/reference/maps/preview', {
        params: { hs6 },
      }),
    );
  },
};
