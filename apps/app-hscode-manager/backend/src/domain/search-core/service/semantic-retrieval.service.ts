import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EmbeddingService } from './embedding.service';
import { Candidate, SearchConstraints } from '../candidate.types';

interface RawRefRow {
  hsr_id: string;
  hsr_hs_code: string;
  hsr_hs6: string;
  hsr_description: string;
  hsr_origin: string | null;
  hsr_unit: string | null;
  hsr_source_company: string | null;
  score?: number;
}

/**
 * FN-001 — 의미검색 후보 회수 (RAG retrieve).
 * 임베딩 공급자 활성 시 pgvector ANN(코사인), 미구성 시 키워드(ILIKE) 폴백.
 * 결과는 HS6 단위로 묶어 근거 행 수(refCount)와 함께 반환한다.
 */
@Injectable()
export class SemanticRetrievalService {
  private readonly logger = new Logger(SemanticRetrievalService.name);

  constructor(
    private readonly embedding: EmbeddingService,
    private readonly dataSource: DataSource,
  ) {}

  async retrieve(
    entId: string,
    queryText: string,
    topN = 5,
    constraints?: SearchConstraints,
  ): Promise<Candidate[]> {
    const enriched = this.enrichQuery(queryText, constraints);

    if (this.embedding.isEnabled) {
      const vec = await this.embedding.embed(enriched);
      if (vec) return this.vectorSearch(entId, vec, topN);
    }
    return this.keywordSearch(entId, enriched, topN);
  }

  private enrichQuery(queryText: string, c?: SearchConstraints): string {
    const extras = [c?.material, c?.usage, c?.processing, c?.origin, c?.unit].filter(Boolean);
    return [queryText, ...extras].join(' ');
  }

  /** pgvector ANN — 코사인 거리 오름차순 */
  private async vectorSearch(entId: string, vec: number[], topN: number): Promise<Candidate[]> {
    const literal = this.embedding.toVectorLiteral(vec);
    const rows: RawRefRow[] = await this.dataSource.query(
      `SELECT hsr_id, hsr_hs_code, hsr_hs6, hsr_description, hsr_origin, hsr_unit,
              hsr_source_company, 1 - (hsr_embedding <=> $1::vector) AS score
         FROM hsm_hs_references
        WHERE ent_id = $2 AND hsr_deleted_at IS NULL AND hsr_embedding IS NOT NULL
        ORDER BY hsr_embedding <=> $1::vector
        LIMIT 200`,
      [literal, entId],
    );
    return this.groupByHs6(rows, topN);
  }

  /** 키워드 폴백 — 품명(Tên hàng) ILIKE, 매칭 토큰 비율로 스코어링 */
  private async keywordSearch(entId: string, queryText: string, topN: number): Promise<Candidate[]> {
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
    const rows: RawRefRow[] = await this.dataSource.query(
      `SELECT hsr_id, hsr_hs_code, hsr_hs6, hsr_description, hsr_origin, hsr_unit, hsr_source_company
         FROM hsm_hs_references
        WHERE ent_id = $1 AND hsr_deleted_at IS NULL AND hsr_description ILIKE ANY($2)
        LIMIT 500`,
      [entId, patterns],
    );

    for (const r of rows) {
      const desc = (r.hsr_description ?? '').toLowerCase();
      const matched = terms.filter((t) => desc.includes(t)).length;
      r.score = matched / terms.length;
    }
    return this.groupByHs6(rows, topN);
  }

  /** HS6 단위 그룹핑: 대표 행(최고 스코어) + refCount, 스코어 내림차순 topN */
  private groupByHs6(rows: RawRefRow[], topN: number): Candidate[] {
    const byHs6 = new Map<string, { best: RawRefRow; count: number }>();
    for (const r of rows) {
      const key = r.hsr_hs6;
      const score = r.score ?? 0;
      const existing = byHs6.get(key);
      if (!existing) {
        byHs6.set(key, { best: r, count: 1 });
      } else {
        existing.count += 1;
        if (score > (existing.best.score ?? 0)) existing.best = r;
      }
    }

    return Array.from(byHs6.values())
      .map(({ best, count }) => ({
        hsCode: best.hsr_hs_code,
        hs6: best.hsr_hs6,
        description: best.hsr_description,
        origin: best.hsr_origin,
        unit: best.hsr_unit,
        score: Number((best.score ?? 0).toFixed(4)),
        sourceRefId: best.hsr_id,
        sourceCompany: best.hsr_source_company,
        refCount: count,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);
  }
}
