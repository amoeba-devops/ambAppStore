import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { EXCEL_QUEUE } from '../excel.constants';
import { ClassifyJobData, ClassifyJobResult, RowResult } from '../excel.types';
import { SemanticRetrievalService } from '../../search-core/service/semantic-retrieval.service';

/**
 * FN-032 — 엑셀 일괄 분류 워커 (BullMQ).
 * 행별로 검색 코어 분류 → 저신뢰(flagThreshold 미만) 행 수동검토 플래그(FR-036) → 진행률 갱신.
 */
@Processor(EXCEL_QUEUE)
export class BatchClassifierProcessor extends WorkerHost {
  private readonly flagThreshold: number;

  constructor(
    private readonly retrieval: SemanticRetrievalService,
    private readonly config: ConfigService,
  ) {
    super();
    this.flagThreshold = Number(this.config.get<string>('THRESHOLD_FLAG', '0.70'));
  }

  async process(job: Job<ClassifyJobData>): Promise<ClassifyJobResult> {
    const { entId, rows } = job.data;
    const results: RowResult[] = [];
    const total = rows.length;

    for (let i = 0; i < total; i += 1) {
      const row = rows[i];
      try {
        const candidates = await this.retrieval.retrieve(entId, row.name, 1, {
          material: row.material,
          usage: row.usage,
          processing: row.processing,
          origin: row.origin,
          unit: row.unit,
        });
        const top = candidates[0];
        if (!top) {
          results.push({
            rowNo: row.rowNo,
            name: row.name,
            hsCode: '—',
            hs6: '',
            confidence: 0,
            status: 'REVIEW',
          });
        } else {
          results.push({
            rowNo: row.rowNo,
            name: row.name,
            hsCode: top.hsCode,
            hs6: top.hs6,
            confidence: top.score,
            status: top.score >= this.flagThreshold ? 'AUTO' : 'REVIEW',
          });
        }
      } catch {
        results.push({
          rowNo: row.rowNo,
          name: row.name,
          hsCode: '—',
          hs6: '',
          confidence: 0,
          status: 'ERROR',
        });
      }
      await job.updateProgress(Math.round(((i + 1) / total) * 100));
    }

    return { results, total };
  }
}
