import { Injectable, Logger } from '@nestjs/common';
import { DataSource, IsNull, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { KnowledgeDocument } from '../entity/knowledge-document.entity';
import { DocChunk } from '../entity/doc-chunk.entity';
import { ChunkingService } from './chunking.service';
import { EmbeddingService } from '../../search-core/service/embedding.service';

export interface IngestResult {
  docId: string;
  chunks: number;
  embedded: number;
}

export interface IngestInput {
  docType: string;
  title: string;
  body: string;
  sourceCountry?: string | null;
  sourceOrg?: string | null;
  language?: string;
  hsVersion?: string | null;
  reliabilityGrade?: string;
  isOfficial?: boolean;
  summary?: string | null;
  chapterTags?: string[] | null;
  materialTags?: string[] | null;
}

/**
 * 지식 문서 적재 (Phase 1 RAG 구축) — 문서 생성 → 청킹 → 임베딩 → hsm_doc_chunks 저장.
 * entId=null → 전역 지식(슈퍼관리자), entId 지정 → 엔티티 LEARNED(확정 재저장분).
 * 임베딩 공급자 미구성 시 청크는 저장하되 벡터는 NULL(키워드 폴백 검색).
 */
@Injectable()
export class KnowledgeIngestService {
  private readonly logger = new Logger(KnowledgeIngestService.name);

  constructor(
    @InjectRepository(KnowledgeDocument)
    private readonly docRepo: Repository<KnowledgeDocument>,
    @InjectRepository(DocChunk)
    private readonly chunkRepo: Repository<DocChunk>,
    private readonly chunking: ChunkingService,
    private readonly embedding: EmbeddingService,
    private readonly dataSource: DataSource,
  ) {}

  async ingest(entId: string | null, input: IngestInput): Promise<IngestResult> {
    const doc = await this.docRepo.save(
      this.docRepo.create({
        entId,
        docType: input.docType,
        title: input.title,
        sourceCountry: input.sourceCountry ?? null,
        sourceOrg: input.sourceOrg ?? null,
        language: input.language ?? 'ko',
        hsVersion: input.hsVersion ?? null,
        chapterTags: input.chapterTags ?? null,
        materialTags: input.materialTags ?? null,
        reliabilityGrade: input.reliabilityGrade ?? 'REFERENCE',
        isOfficial: input.isOfficial ?? false,
        summary: input.summary ?? null,
      }),
    );

    const chunkInputs = this.chunking.chunk(input.docType, input.body);
    if (chunkInputs.length === 0) {
      return { docId: doc.docId, chunks: 0, embedded: 0 };
    }

    const chunks = await this.chunkRepo.save(
      chunkInputs.map((c) =>
        this.chunkRepo.create({
          docId: doc.docId,
          entId,
          chunkType: c.chunkType,
          ruleType: c.ruleType ?? null,
          isAppliesToMix: c.isAppliesToMix ?? false,
          isAppliesToRatio: c.isAppliesToRatio ?? false,
          language: input.language ?? 'ko',
          embeddingText: c.embeddingText,
          citationText: c.citationText,
          chapterTags: input.chapterTags ?? null,
          materialTags: input.materialTags ?? null,
        }),
      ),
      { chunk: 200 },
    );

    const embedded = await this.embedChunks(chunks);
    this.logger.log(`Ingested doc ${doc.docId}: ${chunks.length} chunks, ${embedded} embedded.`);
    return { docId: doc.docId, chunks: chunks.length, embedded };
  }

  /** 청크 임베딩 배치 생성 → chk_embedding(pgvector) 업데이트. 미구성 시 0. */
  private async embedChunks(chunks: DocChunk[]): Promise<number> {
    if (!this.embedding.isEnabled) return 0;
    let embedded = 0;
    // TEI CPU 백엔드 배치 상한 고려 — 8건씩.
    for (let i = 0; i < chunks.length; i += 8) {
      const slice = chunks.slice(i, i + 8);
      const vectors = await this.embedding.embedBatch(slice.map((c) => c.embeddingText));
      for (let k = 0; k < slice.length; k++) {
        const vec = vectors[k];
        if (!vec) continue;
        await this.dataSource.query(
          `UPDATE hsm_doc_chunks SET chk_embedding = $1::vector WHERE chk_id = $2`,
          [this.embedding.toVectorLiteral(vec), slice[k].chkId],
        );
        embedded += 1;
      }
    }
    return embedded;
  }

  /** 문서 목록 (전역 + 해당 엔티티 LEARNED). 청크/임베딩 현황 포함. */
  async listDocuments(entId: string): Promise<
    Array<KnowledgeDocument & { chunkCount: number; embeddedCount: number }>
  > {
    const docs = await this.docRepo.find({
      where: [{ entId: IsNull() }, { entId }],
      order: { createdAt: 'DESC' },
      take: 200,
    });
    if (docs.length === 0) return [];
    const stats: Array<{ doc_id: string; total: string; embedded: string }> =
      await this.dataSource.query(
        `SELECT doc_id, COUNT(*)::text AS total,
                COUNT(chk_embedding)::text AS embedded
           FROM hsm_doc_chunks WHERE doc_id = ANY($1) GROUP BY doc_id`,
        [docs.map((d) => d.docId)],
      );
    const byDoc = new Map(stats.map((s) => [s.doc_id, s]));
    return docs.map((d) => ({
      ...d,
      chunkCount: Number(byDoc.get(d.docId)?.total ?? 0),
      embeddedCount: Number(byDoc.get(d.docId)?.embedded ?? 0),
    }));
  }
}
