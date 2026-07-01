import { apiClient, ApiResponse, unwrap } from '@/lib/api-client';
import type { GtinResolution, ResolveGtinPayload } from '@/types/gtin.types';

export const gtinService = {
  resolve(payload: ResolveGtinPayload): Promise<GtinResolution> {
    return unwrap(apiClient.post<ApiResponse<GtinResolution>>('/gtin/resolve', payload));
  },
};
