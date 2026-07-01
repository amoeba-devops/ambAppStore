import { apiClient, ApiResponse, unwrap } from '@/lib/api-client';
import type { Candidate } from '@/types/hscode.types';
import type { AttributePayload } from '@/types/excel.types';

export const attributeService = {
  classify(payload: AttributePayload): Promise<{ candidates: Candidate[] }> {
    return unwrap(
      apiClient.post<ApiResponse<{ candidates: Candidate[] }>>('/attributes/classify', payload),
    );
  },
};
