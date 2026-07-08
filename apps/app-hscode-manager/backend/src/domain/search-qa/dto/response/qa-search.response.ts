export class CandidateResponse {
  hsCode: string;
  hs6: string;
  description: string;
  origin: string | null;
  unit: string | null;
  score: number; // 0..1
  sourceRefId: string | null;
  sourceCompany: string | null;
  refCount: number;
}

export class QaSearchResponse {
  candidates: CandidateResponse[];
  needQuestion: boolean;
  attributeKey?: 'processing' | 'material' | 'usage';
}

export class ConfirmQaResponse {
  logId: string;
  hsCode: string;
  hs6: string;
  confidence: number;
}
