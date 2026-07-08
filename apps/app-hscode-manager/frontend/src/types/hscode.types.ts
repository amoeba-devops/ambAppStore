export interface Candidate {
  hsCode: string;
  hs6: string;
  description: string;
  origin: string | null;
  unit: string | null;
  score: number; // 0..1
  sourceRefId: string | null;
  sourceCompany: string | null;
  refCount: number;
  rationale?: string; // AI 근거 (FR-006, AI 경유 시)
}

export type AttributeKey = 'processing' | 'material' | 'usage';

export interface QaSearchResult {
  candidates: Candidate[];
  needQuestion: boolean;
  attributeKey?: AttributeKey;
}

export interface SearchConstraints {
  material?: string;
  usage?: string;
  processing?: string;
  origin?: string;
  unit?: string;
}

export interface QaSearchPayload {
  query_text: string;
  round_count?: number;
  session_id?: string;
  constraints?: SearchConstraints;
}

export interface ConfirmQaPayload {
  input_text: string;
  hs_code: string;
  hs6: string;
  confidence: number;
  hsr_id?: string;
  session_id?: string;
}

export interface ConfirmQaResult {
  logId: string;
  hsCode: string;
  hs6: string;
  confidence: number;
}

export interface Citation {
  company: string | null;
  description: string;
  hsCode: string;
  count: number;
}

export interface ResultDetail {
  logId: string;
  mode: string;
  hsCode: string;
  hs6: string;
  description: string | null;
  origin: string | null;
  unit: string | null;
  tradeType: string | null;
  confidence: number | null;
  source: string;
  verifier: string | null;
  recordedAt: string;
  citations: Citation[];
}

/** 신뢰도 밴드 (목업 hi/mid/lo) */
export function confidenceBand(score: number): 'hi' | 'mid' | 'lo' {
  if (score >= 0.9) return 'hi';
  if (score >= 0.6) return 'mid';
  return 'lo';
}
