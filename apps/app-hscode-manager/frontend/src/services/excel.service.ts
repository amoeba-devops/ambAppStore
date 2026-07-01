import { apiClient, ApiResponse, unwrap } from '@/lib/api-client';
import type {
  ClassifyEnqueueResult,
  ExcelValidationResult,
  JobStatus,
} from '@/types/excel.types';

function fileForm(file: File): FormData {
  const fd = new FormData();
  fd.append('file', file);
  return fd;
}

export const excelService = {
  validate(file: File): Promise<ExcelValidationResult> {
    return unwrap(
      apiClient.post<ApiResponse<ExcelValidationResult>>('/excel/validate', fileForm(file), {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
  },
  classify(file: File): Promise<ClassifyEnqueueResult> {
    return unwrap(
      apiClient.post<ApiResponse<ClassifyEnqueueResult>>('/excel/classify', fileForm(file), {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
  },
  job(jobId: string): Promise<JobStatus> {
    return unwrap(apiClient.get<ApiResponse<JobStatus>>(`/excel/jobs/${jobId}`));
  },
  async downloadTemplate(): Promise<void> {
    const res = await apiClient.get('/excel/template', { responseType: 'blob' });
    triggerDownload(res.data as Blob, 'hscode-template.xlsx');
  },
  async downloadResult(jobId: string): Promise<void> {
    const res = await apiClient.get(`/excel/jobs/${jobId}/export`, { responseType: 'blob' });
    triggerDownload(res.data as Blob, `hscode-result-${jobId}.xlsx`);
  },
};

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
