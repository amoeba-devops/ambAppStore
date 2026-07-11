import { apiClient, ApiResponse, unwrap } from '@/lib/api-client';
import type {
  CreateKbPostPayload,
  KbAttachmentRef,
  KbTagRef,
  KbCategory,
  KbDashboardBlock,
  KbDashboardLanding,
  KbListParams,
  KbPostDetail,
  KbPostList,
  KbPostTranslation,
} from '@/types/knowledge-base.types';

/**
 * 지식창고 서비스. 읽기=전원, 쓰기=슈퍼관리자(@SuperAdminOnly).
 * 컴포넌트 직접 호출 금지 — 반드시 이 서비스 경유 (CLAUDE.md FE 규칙).
 */
export const knowledgeBaseService = {
  // ── 대시보드 ──────────────────────────────────────────────
  getLanding(): Promise<KbDashboardLanding> {
    return unwrap(apiClient.get<ApiResponse<KbDashboardLanding>>('/knowledge-base/dashboard'));
  },
  listBlocks(type?: string): Promise<KbDashboardBlock[]> {
    return unwrap(
      apiClient.get<ApiResponse<KbDashboardBlock[]>>('/knowledge-base/dashboard-blocks', {
        params: type ? { type } : undefined,
      }),
    );
  },
  createBlock(payload: Partial<KbDashboardBlock> & { dsb_block_type: string }): Promise<KbDashboardBlock> {
    return unwrap(
      apiClient.post<ApiResponse<KbDashboardBlock>>('/knowledge-base/dashboard-blocks', payload),
    );
  },
  updateBlock(id: string, payload: Record<string, unknown>): Promise<KbDashboardBlock> {
    return unwrap(
      apiClient.patch<ApiResponse<KbDashboardBlock>>(`/knowledge-base/dashboard-blocks/${id}`, payload),
    );
  },
  deleteBlock(id: string): Promise<{ deleted: boolean }> {
    return unwrap(
      apiClient.delete<ApiResponse<{ deleted: boolean }>>(`/knowledge-base/dashboard-blocks/${id}`),
    );
  },
  reorderBlocks(orders: { dsb_id: string; dsb_sort_order: number }[]): Promise<{ reordered: boolean }> {
    return unwrap(
      apiClient.put<ApiResponse<{ reordered: boolean }>>('/knowledge-base/dashboard-blocks/reorder', {
        orders,
      }),
    );
  },

  // ── 카테고리 ──────────────────────────────────────────────
  listCategories(): Promise<KbCategory[]> {
    return unwrap(apiClient.get<ApiResponse<KbCategory[]>>('/knowledge-base/categories'));
  },
  createCategory(payload: {
    cat_name: string;
    cat_sort_order?: number;
    cat_dot_color?: string;
  }): Promise<KbCategory> {
    return unwrap(apiClient.post<ApiResponse<KbCategory>>('/knowledge-base/categories', payload));
  },
  updateCategory(id: string, payload: Record<string, unknown>): Promise<KbCategory> {
    return unwrap(apiClient.patch<ApiResponse<KbCategory>>(`/knowledge-base/categories/${id}`, payload));
  },
  deleteCategory(id: string): Promise<{ deleted: boolean }> {
    return unwrap(
      apiClient.delete<ApiResponse<{ deleted: boolean }>>(`/knowledge-base/categories/${id}`),
    );
  },

  // ── 태그 ──────────────────────────────────────────────────
  listTags(type?: string): Promise<KbTagRef[]> {
    return unwrap(
      apiClient.get<ApiResponse<KbTagRef[]>>('/knowledge-base/tags', {
        params: type ? { type } : undefined,
      }),
    );
  },
  createTag(payload: { tag_name: string; tag_type: string }): Promise<KbTagRef> {
    return unwrap(apiClient.post<ApiResponse<KbTagRef>>('/knowledge-base/tags', payload));
  },
  deleteTag(id: string): Promise<{ deleted: boolean }> {
    return unwrap(apiClient.delete<ApiResponse<{ deleted: boolean }>>(`/knowledge-base/tags/${id}`));
  },

  // ── 게시글 ────────────────────────────────────────────────
  listPosts(params: KbListParams): Promise<KbPostList> {
    return unwrap(apiClient.get<ApiResponse<KbPostList>>('/knowledge-base/posts', { params }));
  },
  getPost(id: string): Promise<KbPostDetail> {
    return unwrap(apiClient.get<ApiResponse<KbPostDetail>>(`/knowledge-base/posts/${id}`));
  },
  createPost(payload: CreateKbPostPayload): Promise<{ pstId: string }> {
    return unwrap(apiClient.post<ApiResponse<{ pstId: string }>>('/knowledge-base/posts', payload));
  },
  updatePost(id: string, payload: Partial<CreateKbPostPayload>): Promise<{ pstId: string }> {
    return unwrap(apiClient.patch<ApiResponse<{ pstId: string }>>(`/knowledge-base/posts/${id}`, payload));
  },
  deletePost(id: string): Promise<{ deleted: boolean }> {
    return unwrap(apiClient.delete<ApiResponse<{ deleted: boolean }>>(`/knowledge-base/posts/${id}`));
  },

  // ── 첨부 ──────────────────────────────────────────────────
  listAttachments(postId: string): Promise<KbAttachmentRef[]> {
    return unwrap(
      apiClient.get<ApiResponse<KbAttachmentRef[]>>(`/knowledge-base/posts/${postId}/attachments`),
    );
  },
  uploadAttachment(postId: string, file: File): Promise<KbAttachmentRef> {
    const fd = new FormData();
    fd.append('file', file);
    return unwrap(
      apiClient.post<ApiResponse<KbAttachmentRef>>(
        `/knowledge-base/posts/${postId}/attachments`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      ),
    );
  },
  deleteAttachment(postId: string, attId: string): Promise<{ deleted: boolean }> {
    return unwrap(
      apiClient.delete<ApiResponse<{ deleted: boolean }>>(
        `/knowledge-base/posts/${postId}/attachments/${attId}`,
      ),
    );
  },
  /** 인증(Bearer) 포함 다운로드 — blob 반환 후 브라우저 저장 트리거용. */
  async downloadAttachment(postId: string, attId: string): Promise<Blob> {
    const res = await apiClient.get(`/knowledge-base/posts/${postId}/attachments/${attId}`, {
      responseType: 'blob',
    });
    return res.data as Blob;
  },

  // ── 번역 (Phase 4) ────────────────────────────────────────
  translate(postId: string, targetLang: string): Promise<KbPostTranslation> {
    return unwrap(
      apiClient.post<ApiResponse<KbPostTranslation>>(
        `/knowledge-base/posts/${postId}/translations`,
        { target_lang: targetLang },
      ),
    );
  },

  // ── RAG 승격 (Phase 5) ────────────────────────────────────
  promoteToRag(postId: string): Promise<{ docId: string }> {
    return unwrap(
      apiClient.post<ApiResponse<{ docId: string }>>(
        `/knowledge-base/posts/${postId}/promote-to-rag`,
        {},
      ),
    );
  },
};
