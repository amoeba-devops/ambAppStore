import { apiClient, ApiResponse, unwrap } from '@/lib/api-client';
import type { ApprovalItem, MatchRequest, Paginated, RequestDetail } from '@/types/agent.types';

/** 문서 업로드 매칭 (Phase 2, 주 기능). */
export const matchingService = {
  /** 문서 업로드 → AI 파싱 → RAG 매칭 → 추천 리스트. */
  upload(file: File): Promise<RequestDetail> {
    const fd = new FormData();
    fd.append('file', file);
    return unwrap(
      apiClient.post<ApiResponse<RequestDetail>>('/matching/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
  },

  listRequests(page = 1, size = 20): Promise<Paginated<MatchRequest>> {
    return unwrap(
      apiClient.get<ApiResponse<Paginated<MatchRequest>>>('/matching/requests', {
        params: { page, size },
      }),
    );
  },

  getRequest(id: string): Promise<RequestDetail> {
    return unwrap(apiClient.get<ApiResponse<RequestDetail>>(`/matching/requests/${id}`));
  },

  /** 추천 승인/컨펌 → 요청건 저장 + LEARNED 재저장. */
  confirm(id: string, approvals: ApprovalItem[]): Promise<RequestDetail> {
    return unwrap(
      apiClient.post<ApiResponse<RequestDetail>>(`/matching/requests/${id}/confirm`, { approvals }),
    );
  },
};
