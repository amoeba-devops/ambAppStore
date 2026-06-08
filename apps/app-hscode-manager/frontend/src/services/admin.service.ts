import { apiClient } from '@/lib/api-client';
import { unwrap, ApiEnvelope } from '@/lib/api-response';

export type PolicyValueType = 'number' | 'boolean' | 'string' | 'json';

export interface PolicyThreshold {
  id: string;
  importCountryCode: string | null;
  key: string;
  value: string;
  valueType: PolicyValueType;
  description: string | null;
  updatedAt: string;
}

export interface PolicyListResponse {
  items: PolicyThreshold[];
  defaultKeys: Array<{ key: string; type: string; description: string }>;
}

export interface UpsertPolicyDto {
  import_country_code?: string;
  key: string;
  value: string;
  value_type: PolicyValueType;
  description?: string;
}

export type UcrStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED';

export interface UnsupportedCountryRequest {
  id: string;
  requestedCountryCode: string;
  businessCase: string | null;
  estimatedVolume: number | null;
  status: UcrStatus;
  userEmail: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

export interface CreateUcrDto {
  requested_country_code: string;
  business_case?: string;
  estimated_volume?: number;
}

export interface KpiDashboard {
  periodMonths: number;
  rank1HitRate: number;
  seizureRate: number;
  correctionRate: number;
  sealedRate: number;
  ai: {
    totalCalls: number;
    okRate: number;
    hallucinationRate: number;
    avgLatencyMs: number;
    totalCostUsd: number;
  };
  totals: {
    inquiries: number;
    classifications: number;
    adopted: number;
    sealed: number;
    superseded: number;
    disputed: number;
    seizureEvents: number;
    seizureAmountUsd: number;
  };
  monthlyTrend: Array<{
    yearMonth: string;
    adopted: number;
    superseded: number;
    sealed: number;
    seizureCount: number;
  }>;
}

export const adminService = {
  listPolicies: async (): Promise<PolicyListResponse> => {
    const { data } = await apiClient.get<ApiEnvelope<PolicyListResponse>>(
      '/v1/admin/policy-thresholds',
    );
    return unwrap(data);
  },
  upsertPolicy: async (dto: UpsertPolicyDto): Promise<{ id: string }> => {
    const { data } = await apiClient.post<ApiEnvelope<{ id: string }>>(
      '/v1/admin/policy-thresholds',
      dto,
    );
    return unwrap(data);
  },
  removePolicy: async (id: string): Promise<void> => {
    const { data } = await apiClient.delete<ApiEnvelope<{ deleted: true }>>(
      `/v1/admin/policy-thresholds/${id}`,
    );
    unwrap(data);
  },
  listUcr: async (status?: UcrStatus): Promise<UnsupportedCountryRequest[]> => {
    const { data } = await apiClient.get<ApiEnvelope<UnsupportedCountryRequest[]>>(
      '/v1/admin/unsupported-country-requests',
      { params: status ? { status } : undefined },
    );
    return unwrap(data);
  },
  createUcr: async (
    dto: CreateUcrDto,
  ): Promise<{ id: string; status: UcrStatus }> => {
    const { data } = await apiClient.post<
      ApiEnvelope<{ id: string; status: UcrStatus }>
    >('/v1/admin/unsupported-country-requests', dto);
    return unwrap(data);
  },
  updateUcrStatus: async (
    id: string,
    status: UcrStatus,
    note?: string,
  ): Promise<{ id: string; status: UcrStatus }> => {
    const { data } = await apiClient.patch<
      ApiEnvelope<{ id: string; status: UcrStatus }>
    >(`/v1/admin/unsupported-country-requests/${id}/status`, { status, note });
    return unwrap(data);
  },
  kpiDashboard: async (months = 6): Promise<KpiDashboard> => {
    const { data } = await apiClient.get<ApiEnvelope<KpiDashboard>>(
      '/v1/admin/kpi-dashboard',
      { params: { months } },
    );
    return unwrap(data);
  },
};
