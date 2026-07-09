import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EmbeddingService } from '../../search-core/service/embedding.service';

export interface KnowledgeSnippet {
  chunkId: string;
  docId: string;
  docTitle: string;
  docType: string;
  sourceCountry: string | null;
  chunkType: string;
  citationText: string;
  score: number;
}

interface RawChunkRow {
  chk_id: string;
  doc_id: string;
  doc_title: string;
  doc_type: string;
  doc_source_country: string | null;
  chk_type: string;
  chk_citation_text: string;
  score: number;
}

/**
 * 지식(기준표 해설·법령·사례) 검색 — Phase 1 RAG 구축의 회수 계층.
 * hsm_doc_chunks 대상 하이브리드(벡터 + 키워드), 전역(ent_id NULL) + 엔티티 LEARNED 결합.
 * **VN 가중 우선**(R2·R7) — VN 출처 청크 스코어 가산. 매칭/Q&A에서 근거 컨텍스트로 소비 예정.
 */
@Injectable()
export class KnowledgeRetrievalService {
  private readonly logger = new Logger(KnowledgeRetrievalService.name);
  private readonly VN_BONUS = 0.08;

  constructor(
    private readonly embedding: EmbeddingService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 지식 청크 회수. entId=현재 테넌트(전역 NULL 포함). VN 우선 가중 후 topN.
   */
  async retrieve(entId: string, queryText: string, topN = 5): Promise<KnowledgeSnippet[]> {
    const q = (queryText ?? '').trim();
    if (!q) return [];

    let rows: RawChunkRow[] = [];
    if (this.embedding.isEnabled) {
      const vec = await this.embedding.embed(q);
      if (vec) {
        const [vecRows, kwRows] = await Promise.all([
          this.vectorSearch(entId, vec),
          this.keywordSearch(entId, q),
        ]);
        rows = this.fuse(vecRows, kwRows);
      }
    }
    if (rows.length === 0) {
      rows = await this.keywordSearch(entId, q);
    }

    return rows
      .map((r) => this.toSnippet(r))
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);
  }

  private async vectorSearch(entId: string, vec: number[]): Promise<RawChunkRow[]> {
    const literal = this.embedding.toVectorLiteral(vec);
    return this.dataSource.query(
      `SELECT k.chk_id, k.doc_id, d.doc_title, d.doc_type, d.doc_source_country,
              k.chk_type, k.chk_citation_text, 1 - (k.chk_embedding <=> $1::vector) AS score
         FROM hsm_doc_chunks k
         JOIN hsm_documents d ON d.doc_id = k.doc_id AND d.doc_deleted_at IS NULL
        WHERE (k.ent_id = $2 OR k.ent_id IS NULL) AND k.chk_embedding IS NOT NULL
        ORDER BY k.chk_embedding <=> $1::vector
        LIMIT 50`,
      [literal, entId],
    );
  }

  private async keywordSearch(entId: string, queryText: string): Promise<RawChunkRow[]> {
    const terms = Array.from(
      new Set(
        queryText
          .toLowerCase()
          .split(/[\s,/()]+/)
          .map((t) => t.trim())
          .filter((t) => t.length >= 2),
      ),
    ).slice(0, 12);
    if (terms.length === 0) return [];

    const patterns = terms.map((t) => `%${t}%`);
    const rows: RawChunkRow[] = await this.dataSource.query(
      `SELECT k.chk_id, k.doc_id, d.doc_title, d.doc_type, d.doc_source_country,
              k.chk_type, k.chk_citation_text
         FROM hsm_doc_chunks k
         JOIN hsm_documents d ON d.doc_id = k.doc_id AND d.doc_deleted_at IS NULL
        WHERE (k.ent_id = $1 OR k.ent_id IS NULL) AND k.chk_embedding_text ILIKE ANY($2)
        LIMIT 200`,
      [entId, patterns],
    );
    for (const r of rows) {
      const text = (r.chk_citation_text ?? '').toLowerCase();
      const matched = terms.filter((t) => text.includes(t)).length;
      r.score = matched / terms.length;
    }
    return rows;
  }

  /** 벡터·키워드 융합(chk_id 병합, max + 양쪽 보너스). */
  private fuse(vecRows: RawChunkRow[], kwRows: RawChunkRow[]): RawChunkRow[] {
    const merged = new Map<string, { row: RawChunkRow; vec: number; kw: number }>();
    for (const r of vecRows) merged.set(r.chk_id, { row: r, vec: Number(r.score) || 0, kw: 0 });
    for (const r of kwRows) {
      const e = merged.get(r.chk_id);
      if (e) e.kw = Number(r.score) || 0;
      else merged.set(r.chk_id, { row: r, vec: 0, kw: Number(r.score) || 0 });
    }
    return Array.from(merged.values()).map(({ row, vec, kw }) => ({
      ...row,
      score: Math.min(1, Math.max(vec, kw) + (vec > 0 && kw > 0 ? 0.05 : 0)),
    }));
  }

  /** VN 가중 적용 후 스니펫 변환. */
  private toSnippet(r: RawChunkRow): KnowledgeSnippet {
    const base = Number(r.score) || 0;
    const boosted = r.doc_source_country === 'VN' ? Math.min(1, base + this.VN_BONUS) : base;
    return {
      chunkId: r.chk_id,
      docId: r.doc_id,
      docTitle: r.doc_title,
      docType: r.doc_type,
      sourceCountry: r.doc_source_country,
      chunkType: r.chk_type,
      citationText: r.chk_citation_text,
      score: Number(boosted.toFixed(4)),
    };
  }
}
