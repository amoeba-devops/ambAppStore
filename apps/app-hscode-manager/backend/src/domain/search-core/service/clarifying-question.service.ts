import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Candidate, ClarifyDecision } from '../candidate.types';

/**
 * FN-002 — 명확화 질문 판단 (POL-001).
 * top1−top2 점수 gap < gapThreshold 이고 라운드 < max 면 1개 속성을 물어 재랭크 유도.
 * 질문 텍스트/칩은 프론트가 attributeKey로 i18n 렌더(백엔드 메시지 영어 고정 원칙).
 */
@Injectable()
export class ClarifyingQuestionService {
  private readonly gapThreshold: number;
  private readonly maxRounds: number;
  private readonly order: Array<'processing' | 'material' | 'usage'> = [
    'processing',
    'material',
    'usage',
  ];

  constructor(private readonly config: ConfigService) {
    this.gapThreshold = Number(this.config.get<string>('THRESHOLD_GAP', '0.08'));
    this.maxRounds = Number(this.config.get<string>('MAX_CLARIFY_ROUNDS', '5'));
  }

  decide(candidates: Candidate[], roundCount: number): ClarifyDecision {
    if (candidates.length < 2 || roundCount >= this.maxRounds) {
      return { needQuestion: false };
    }
    const gap = candidates[0].score - candidates[1].score;
    if (gap >= this.gapThreshold) {
      return { needQuestion: false };
    }
    const attributeKey = this.order[roundCount % this.order.length];
    return { needQuestion: true, attributeKey };
  }
}
