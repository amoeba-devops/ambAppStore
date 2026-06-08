import { apiClient } from '@/lib/api-client';
import { unwrap, ApiEnvelope } from '@/lib/api-response';
import type {
  Classification,
  PaginatedClassifications,
  ResponseFormResult,
} from '@/types/classification.types';
import type { CandidateSource } from '@/types/matching.types';

export interface CandidateSnapshotDto {
  hs_code: string;
  description?: string;
  basic_tariff_rate?: number;
  fta_tariff_rate?: number;
  fta_agreement_code?: string;
  source: CandidateSource;
  ranking: number;
  confidence: number;
  reasoning?: string;
  source_citations?: string[];
  external_adapter_keys?: string[];
  flags?: Record<string, boolean>;
  past_adoption_count?: number;
}

export interface ConfirmClassificationDto {
  inquiry_id: string;
  item_id: string;
  selected_hs_code: string;
  selection_rationale?: string;
  overwrite_existing?: boolean;
  ai_model_version?: string;
  candidates: CandidateSnapshotDto[];
}

export interface ConfirmResult {
  classification: Classification;
  supersededId: string | null;
}

export interface ListClassificationsQuery {
  exporter_id?: string;
  import_country?: string;
  export_country?: string;
  hs_code?: string;
  category?: string;
  status?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  page_size?: number;
}

export const classificationService = {
  confirm: async (dto: ConfirmClassificationDto): Promise<ConfirmResult> => {
    const { data } = await apiClient.post<ApiEnvelope<ConfirmResult>>(
      '/v1/classifications',
      dto,
    );
    return unwrap(data);
  },
  list: async (query: ListClassificationsQuery = {}): Promise<PaginatedClassifications> => {
    const { data } = await apiClient.get<ApiEnvelope<PaginatedClassifications>>(
      '/v1/classifications',
      { params: query },
    );
    return unwrap(data);
  },
  get: async (id: string): Promise<Classification & { historyIds: string[] }> => {
    const { data } = await apiClient.get<
      ApiEnvelope<Classification & { historyIds: string[] }>
    >(`/v1/classifications/${id}`);
    return unwrap(data);
  },
  responseForm: async (
    id: string,
    channel: 'email' | 'kakao' | 'messenger' | 'plain',
    lang: 'ko' | 'en' | 'vi',
  ): Promise<ResponseFormResult> => {
    const { data } = await apiClient.get<ApiEnvelope<ResponseFormResult>>(
      `/v1/classifications/${id}/response-form`,
      { params: { channel, lang } },
    );
    return unwrap(data);
  },
  rank1HitRate: async (days = 90): Promise<{ rank1HitRate: number; days: number }> => {
    const { data } = await apiClient.get<
      ApiEnvelope<{ rank1HitRate: number; days: number }>
    >('/v1/classifications/rank1-hit-rate', { params: { days } });
    return unwrap(data);
  },
};
