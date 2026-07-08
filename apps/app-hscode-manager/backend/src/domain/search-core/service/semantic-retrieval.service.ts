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
 * 임베딩 활성 시 **하이브리드**(pgvector 코사인 + 키워드 ILIKE를 융합) — 의미/교차언어는 벡터가,
 * 희소 산업용어·품번은 키워드가 보완. 임베딩 미구성 시 키워드 단독 폴백.
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
      if (vec) {
        // 하이브리드: 벡터 + 키워드 병렬 실행 후 융합.
        const [vecList, kwList] = await Promise.all([
          this.vectorSearch(entId, vec),
          this.keywordSearch(entId, enriched),
        ]);
        return this.fuseHybrid(vecList, kwList, topN);
      }
    }
    return this.keywordSearch(entId, enriched).then((l) => l.slice(0, topN));
  }

  private enrichQuery(queryText: string, c?: SearchConstraints): string {
    const extras = [c?.material, c?.usage, c?.processing, c?.origin, c?.unit].filter(Boolean);
    return [queryText, ...extras].join(' ');
  }

  /** pgvector ANN — 코사인 유사도(1 - 거리), HS6 그룹핑(슬라이스 없음). */
  private async vectorSearch(entId: string, vec: number[]): Promise<Candidate[]> {
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
    return this.groupByHs6(rows);
  }

  /** 키워드 — 품명(Tên hàng) ILIKE, 매칭 토큰 비율 스코어, HS6 그룹핑(슬라이스 없음). */
  private async keywordSearch(entId: string, queryText: string): Promise<Candidate[]> {
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
    return this.groupByHs6(rows);
  }

  /**
   * 벡터·키워드 후보 융합: HS6 키로 병합, hybridScore = max(vec,kw) + 양쪽 존재 보너스(0.05, 상한 1).
   * 단일 신호 강세를 벌하지 않으면서 양쪽 합의를 가산. 대표 행은 벡터 우선(인용 유지), refCount는 최대.
   */
  private fuseHybrid(vecList: Candidate[], kwList: Candidate[], topN: number): Candidate[] {
    const merged = new Map<string, { cand: Candidate; vec: number; kw: number }>();
    for (const c of vecList) merged.set(c.hs6, { cand: c, vec: c.score, kw: 0 });
    for (const c of kwList) {
      const e = merged.get(c.hs6);
      if (e) {
        e.kw = c.score;
        e.cand.refCount = Math.max(e.cand.refCount, c.refCount);
      } else {
        merged.set(c.hs6, { cand: c, vec: 0, kw: c.score });
      }
    }
    return Array.from(merged.values())
      .map(({ cand, vec, kw }) => ({
        ...cand,
        score: Number(Math.min(1, Math.max(vec, kw) + (vec > 0 && kw > 0 ? 0.05 : 0)).toFixed(4)),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);
  }

  /** HS6 단위 그룹핑: 대표 행(최고 스코어) + refCount, 스코어 내림차순(슬라이스 없음). */
  private groupByHs6(rows: RawRefRow[]): Candidate[] {
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
      .sort((a, b) => b.score - a.score);
  }
}
