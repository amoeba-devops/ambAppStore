import { apiClient, ApiResponse, unwrap } from '@/lib/api-client';
import type { ResultDetail } from '@/types/hscode.types';

export const resultService = {
  getDetail(id: string): Promise<ResultDetail> {
    return unwrap(apiClient.get<ApiResponse<ResultDetail>>(`/results/${id}`));
  },
};
