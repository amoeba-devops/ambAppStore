/** 검색 코어 공통 타입 (FN-001~003) */

export interface SearchConstraints {
  material?: string;
  usage?: string;
  processing?: string;
  origin?: string;
  unit?: string;
}

/** 후보 HS코드 (의미검색 결과 단위) */
export interface Candidate {
  hsCode: string;
  hs6: string;
  description: string;
  origin: string | null;
  unit: string | null;
  score: number; // 0..1 (AI 판정 시 AI 신뢰도로 대체)
  sourceRefId: string | null;
  sourceCompany: string | null;
  refCount: number; // 동일 HS6 근거 행 수 (FR-006)
  rationale?: string; // AI 근거 (FR-006, AI 경유 시에만)
}

/** 3모드 공통 정규화 결과 객체 (FR-041 / FN-003) */
export interface NormalizedResult {
  hsCode: string;
  hs6: string;
  description: string;
  confidence: number; // 0..1
  source: string; // REFERENCE | DIRECT | GPC | API | MANUAL
  country?: string;
}

/** 명확화 질문 판단 결과 (FN-002) */
export interface ClarifyDecision {
  needQuestion: boolean;
  attributeKey?: 'processing' | 'material' | 'usage';
}
