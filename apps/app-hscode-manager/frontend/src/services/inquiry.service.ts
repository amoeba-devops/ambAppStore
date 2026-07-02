import { apiClient } from '@/lib/api-client';
import { unwrap, ApiEnvelope } from '@/lib/api-response';
import type { Inquiry, InquiryStatus } from '@/types/inquiry.types';

export interface CreateInquiryDto {
  exporter_id: string;
  export_country_code: string;
  import_country_code: string;
  title?: string;
  memo?: string;
}

export interface ListInquiriesQuery {
  exporter_id?: string;
  import_country?: string;
  status?: string;
  page?: number;
  page_size?: number;
}

export interface PaginatedInquiries {
  items: Inquiry[];
  total: number;
  page: number;
  pageSize: number;
}

export const inquiryService = {
  list: async (query: ListInquiriesQuery = {}): Promise<PaginatedInquiries> => {
    const { data } = await apiClient.get<ApiEnvelope<PaginatedInquiries>>(
      '/v1/inquiries',
      { params: query },
    );
    return unwrap(data);
  },
  get: async (id: string): Promise<Inquiry> => {
    const { data } = await apiClient.get<ApiEnvelope<Inquiry>>(`/v1/inquiries/${id}`);
    return unwrap(data);
  },
  create: async (dto: CreateInquiryDto): Promise<Inquiry> => {
    const { data } = await apiClient.post<ApiEnvelope<Inquiry>>('/v1/inquiries', dto);
    return unwrap(data);
  },
  updateStatus: async (id: string, status: InquiryStatus): Promise<Inquiry> => {
    const { data } = await apiClient.patch<ApiEnvelope<Inquiry>>(
      `/v1/inquiries/${id}/status`,
      { status },
    );
    return unwrap(data);
  },
};
