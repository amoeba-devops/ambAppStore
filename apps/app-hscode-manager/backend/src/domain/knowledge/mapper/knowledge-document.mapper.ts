import { KnowledgeDocument } from '../entity/knowledge-document.entity';
import { KnowledgeDocumentResponse } from '../dto/response/knowledge-document.response';

type DocWithStats = KnowledgeDocument & { chunkCount: number; embeddedCount: number };

/** Entity(+청크 통계) → Response 변환. */
export class KnowledgeDocumentMapper {
  static toResponse(doc: DocWithStats): KnowledgeDocumentResponse {
    return {
      docId: doc.docId,
      scope: doc.entId ? 'ENTITY' : 'GLOBAL',
      docType: doc.docType,
      title: doc.title,
      sourceCountry: doc.sourceCountry,
      sourceOrg: doc.sourceOrg,
      language: doc.language,
      reliabilityGrade: doc.reliabilityGrade,
      isOfficial: doc.isOfficial,
      chunkCount: doc.chunkCount,
      embeddedCount: doc.embeddedCount,
      createdAt: doc.createdAt,
    };
  }

  static toListResponse(docs: DocWithStats[]): KnowledgeDocumentResponse[] {
    return docs.map((d) => this.toResponse(d));
  }
}
