import { apiClient, ApiResponse, unwrap } from '@/lib/api-client';
import type {
  ConfirmQaPayload,
  ConfirmQaResult,
  QaSearchPayload,
  QaSearchResult,
} from '@/types/hscode.types';

export const qaService = {
  search(payload: QaSearchPayload): Promise<QaSearchResult> {
    return unwrap(apiClient.post<ApiResponse<QaSearchResult>>('/qa/search', payload));
  },
  confirm(payload: ConfirmQaPayload): Promise<ConfirmQaResult> {
    return unwrap(apiClient.post<ApiResponse<ConfirmQaResult>>('/qa/confirm', payload));
  },
};
