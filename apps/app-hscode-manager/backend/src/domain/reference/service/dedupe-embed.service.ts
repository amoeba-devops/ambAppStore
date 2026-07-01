import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { HsReference } from '../entity/hs-reference.entity';
import { NormalizedReferenceRow } from '../adapters/import-adapter.interface';
import { EmbeddingService } from '../../search-core/service/embedding.service';

export interface DedupePersistResult {
  imported: number;
  deduped: number;
}

/**
 * 중복 제거(FR-044) + 임베딩 생성(FN-041) → RAG 코퍼스 적재.
 * dedupe key = HS + 정규화 품명 + 원산지 + 단위.
 */
@Injectable()
export class DedupeEmbedService {
  private readonly logger = new Logger(DedupeEmbedService.name);

  constructor(
    @InjectRepository(HsReference)
    private readonly hsReferenceRepo: Repository<HsReference>,
    private readonly embedding: EmbeddingService,
    private readonly dataSource: DataSource,
  ) {}

  private dedupeKey(r: NormalizedReferenceRow): string {
    const norm = (s: string | null) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
    return [r.hsCode, norm(r.description), norm(r.origin), norm(r.unit)].join('|');
  }

  /** 배치 내 중복 제거 후 적재 + (가능 시) 임베딩 생성 */
  async persist(
    entId: string,
    importBatchId: string,
    rows: NormalizedReferenceRow[],
  ): Promise<DedupePersistResult> {
    const seen = new Set<string>();
    const unique: NormalizedReferenceRow[] = [];
    let deduped = 0;

    for (const r of rows) {
      const key = this.dedupeKey(r);
      if (seen.has(key)) {
        deduped += 1;
        continue;
      }
      seen.add(key);
      unique.push(r);
    }

    if (unique.length === 0) return { imported: 0, deduped };

    const entities = unique.map((r) =>
      this.hsReferenceRepo.create({
        entId,
        hsCode: r.hsCode,
        hs6: r.hs6,
        description: r.description,
        origin: r.origin,
        unit: r.unit,
        unitPrice: r.unitPrice,
        tradeType: r.tradeType,
        sourceCompany: r.sourceCompany,
        importBatchId,
      }),
    );

    const saved = await this.hsReferenceRepo.save(entities, { chunk: 500 });
    await this.embed(saved);

    return { imported: saved.length, deduped };
  }

  /** 신규 행 임베딩 생성 → pgvector(hsr_embedding) 업데이트. 공급자 미구성 시 스킵. */
  private async embed(rows: HsReference[]): Promise<void> {
    if (!this.embedding.isEnabled) {
      this.logger.debug(`Embedding skipped for ${rows.length} rows (provider disabled).`);
      return;
    }
    for (const row of rows) {
      const vec = await this.embedding.embed(row.description);
      if (!vec) continue;
      await this.dataSource.query(
        `UPDATE hsm_hs_references SET hsr_embedding = $1::vector WHERE hsr_id = $2`,
        [this.embedding.toVectorLiteral(vec), row.hsrId],
      );
    }
  }
}
