import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MATCHING_QUEUE, MATCHING_WORKER_CONCURRENCY } from '../matching.constants';
import { MatchingService } from '../service/matching.service';

interface MatchingJobData {
  entId: string;
  mrqId: string;
}

/**
 * 문서 업로드 매칭 워커 (BullMQ) — 대량 비동기 처리.
 * 요청건의 품목을 백그라운드로 매칭(면장+기준표 RAG → AI 재판정 → 추천). 진행률·완료는 서비스가 DB 갱신.
 * 동시성은 2코어 + CPU TEI 보호를 위해 낮게(MATCHING_WORKER_CONCURRENCY).
 */
@Processor(MATCHING_QUEUE, { concurrency: MATCHING_WORKER_CONCURRENCY })
export class MatchingProcessor extends WorkerHost {
  private readonly logger = new Logger(MatchingProcessor.name);

  constructor(private readonly matching: MatchingService) {
    super();
  }

  async process(job: Job<MatchingJobData>): Promise<void> {
    const { entId, mrqId } = job.data;
    this.logger.log(`Processing match request ${mrqId}`);
    await this.matching.processRequest(entId, mrqId);
  }
}
