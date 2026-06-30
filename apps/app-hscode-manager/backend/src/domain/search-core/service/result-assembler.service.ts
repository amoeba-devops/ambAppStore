import { Injectable } from '@nestjs/common';
import { Candidate, NormalizedResult } from '../candidate.types';

/** FN-003 — 3모드 공통 정규화 결과 객체 조립 (FR-041) */
@Injectable()
export class ResultAssemblerService {
  fromCandidate(c: Candidate, source = 'REFERENCE', country?: string): NormalizedResult {
    return {
      hsCode: c.hsCode,
      hs6: c.hs6,
      description: c.description,
      confidence: c.score,
      source,
      country,
    };
  }
}
