import { apiClient } from '@/lib/api-client';

export interface ProductMasterImportResult {
  total: number;
  inserted: number;
  updated: number;
  errors: { row: number; field: string; message: string }[];
}

export const productMasterExcelApi = {
  downloadTemplate: () =>
    apiClient.get('/v1/product-master/template', { responseType: 'blob' }),

  exportData: () =>
    apiClient.get('/v1/product-master/export', { responseType: 'blob' }),

  importData: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post<{ success: boolean; data: ProductMasterImportResult }>(
      '/v1/product-master/import',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      },
    );
  },
};
