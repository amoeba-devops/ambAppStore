import { apiClient } from '@/lib/api-client';
import { unwrap, ApiEnvelope } from '@/lib/api-response';
import type {
  ExpertReview,
  ExpertRole,
  ReviewVerdict,
} from '@/types/expert.types';

export interface ListExpertReviewsQuery {
  role?: ExpertRole;
  verdict?: ReviewVerdict;
  classification_id?: string;
}

export interface RespondReviewDto {
  verdict: 'APPROVE' | 'REVISE' | 'REJECT';
  notes?: string;
}

export const expertService = {
  list: async (query: ListExpertReviewsQuery = {}): Promise<ExpertReview[]> => {
    const { data } = await apiClient.get<ApiEnvelope<ExpertReview[]>>(
      '/v1/expert-reviews',
      { params: query },
    );
    return unwrap(data);
  },
  get: async (id: string): Promise<ExpertReview> => {
    const { data } = await apiClient.get<ApiEnvelope<ExpertReview>>(
      `/v1/expert-reviews/${id}`,
    );
    return unwrap(data);
  },
  respond: async (id: string, dto: RespondReviewDto): Promise<ExpertReview> => {
    const { data } = await apiClient.patch<ApiEnvelope<ExpertReview>>(
      `/v1/expert-reviews/${id}/respond`,
      dto,
    );
    return unwrap(data);
  },
};
