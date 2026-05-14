import { apiClient } from '@/lib/api-client';
import { unwrap, ApiEnvelope } from '@/lib/api-response';
import type {
  KpiSummary,
  ReviewQueueItem,
  VerificationEvent,
  VerificationEventType,
  VerificationResult,
} from '@/types/verification.types';

export interface CreateVerificationDto {
  classification_id: string;
  event_type: VerificationEventType;
  event_date: string;
  result?: VerificationResult;
  amount_usd?: number;
  notes?: string;
}

export interface CreateVerificationResult {
  event: VerificationEvent;
  followUpCount: number;
  followUpActions: Array<Record<string, unknown>>;
}

export const verificationService = {
  create: async (dto: CreateVerificationDto): Promise<CreateVerificationResult> => {
    const { data } = await apiClient.post<ApiEnvelope<CreateVerificationResult>>(
      '/v1/verifications',
      dto,
    );
    return unwrap(data);
  },
  list: async (classificationId?: string): Promise<VerificationEvent[]> => {
    const { data } = await apiClient.get<ApiEnvelope<VerificationEvent[]>>(
      '/v1/verifications',
      {
        params: classificationId
          ? { classification_id: classificationId }
          : undefined,
      },
    );
    return unwrap(data);
  },
  reviewQueue: async (openOnly = true): Promise<ReviewQueueItem[]> => {
    const { data } = await apiClient.get<ApiEnvelope<ReviewQueueItem[]>>(
      '/v1/verifications/review-queue',
      { params: { open_only: openOnly ? 'true' : 'false' } },
    );
    return unwrap(data);
  },
  resolveQueue: async (id: string, notes?: string): Promise<ReviewQueueItem> => {
    const { data } = await apiClient.patch<ApiEnvelope<ReviewQueueItem>>(
      `/v1/verifications/review-queue/${id}/resolve`,
      { notes },
    );
    return unwrap(data);
  },
  kpi: async (months = 1): Promise<KpiSummary> => {
    const { data } = await apiClient.get<ApiEnvelope<KpiSummary>>(
      '/v1/verifications/kpi',
      { params: { months } },
    );
    return unwrap(data);
  },
};
