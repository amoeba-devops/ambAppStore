import { apiClient } from '@/lib/api-client';
import { unwrap, ApiEnvelope } from '@/lib/api-response';
import type { MatchingRunResult } from '@/types/matching.types';

export interface MatchingRunDto {
  inquiry_id: string;
  item_id: string;
  ai_disabled?: boolean;
  force_external?: boolean;
}

export const matchingService = {
  run: async (dto: MatchingRunDto): Promise<MatchingRunResult> => {
    const { data } = await apiClient.post<ApiEnvelope<MatchingRunResult>>(
      '/v1/matching/run',
      dto,
    );
    return unwrap(data);
  },
  adaptersHealth: async (): Promise<
    Array<{
      adapterKey: string;
      importCountryCode: string;
      displayName: string;
      ok: boolean;
      latencyMs: number;
    }>
  > => {
    const { data } = await apiClient.get<
      ApiEnvelope<
        Array<{
          adapterKey: string;
          importCountryCode: string;
          displayName: string;
          ok: boolean;
          latencyMs: number;
        }>
      >
    >('/v1/matching/adapters/health');
    return unwrap(data);
  },
};
