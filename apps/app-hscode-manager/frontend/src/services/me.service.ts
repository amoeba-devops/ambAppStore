import { apiClient } from '@/lib/api-client';
import { unwrap, ApiEnvelope } from '@/lib/api-response';
import type { MeProfile } from '@/types/master.types';

export const meService = {
  get: async (): Promise<MeProfile> => {
    const { data } = await apiClient.get<ApiEnvelope<MeProfile>>('/v1/me');
    return unwrap(data);
  },
};
