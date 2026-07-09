import { apiClient, ApiResponse, unwrap } from '@/lib/api-client';
import type { HsTableImportResult, IngestResult, KnowledgeDocument } from '@/types/agent.types';

/** 레퍼런스(RAG) 구축 — HS 기준표 + 지식 문서 (Phase 1). */
export const knowledgeService = {
  /** HS 기준표(VN/KR/CN/US) 파일 → 마스터 적재 (슈퍼관리자). */
  importHsCodes(file: File, system: string, version?: string): Promise<HsTableImportResult> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('system', system);
    if (version) fd.append('version', version);
    return unwrap(
      apiClient.post<ApiResponse<HsTableImportResult>>('/knowledge/hs-codes/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
  },

  listDocuments(): Promise<KnowledgeDocument[]> {
    return unwrap(apiClient.get<ApiResponse<KnowledgeDocument[]>>('/knowledge/documents'));
  },

  /** 전역 지식 문서 적재 → 청킹·임베딩 (슈퍼관리자). */
  createDocument(payload: {
    doc_type: string;
    title: string;
    body: string;
    source_country?: string;
    reliability_grade?: string;
  }): Promise<IngestResult> {
    return unwrap(apiClient.post<ApiResponse<IngestResult>>('/knowledge/documents', payload));
  },
};
