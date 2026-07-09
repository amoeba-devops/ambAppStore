/** 지식 문서 응답 (camelCase). 청크/임베딩 현황 포함. */
export class KnowledgeDocumentResponse {
  docId: string;
  scope: 'GLOBAL' | 'ENTITY'; // ent_id NULL=GLOBAL
  docType: string;
  title: string;
  sourceCountry: string | null;
  sourceOrg: string | null;
  language: string;
  reliabilityGrade: string;
  isOfficial: boolean;
  chunkCount: number;
  embeddedCount: number;
  createdAt: Date;
}

/** 지식 적재 결과 응답. */
export class IngestResultResponse {
  docId: string;
  chunks: number;
  embedded: number;
}
