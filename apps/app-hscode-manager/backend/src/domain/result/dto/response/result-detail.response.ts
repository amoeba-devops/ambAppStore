export class CitationResponse {
  company: string | null;
  description: string;
  hsCode: string;
  count: number;
}

export class ResultDetailResponse {
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
  citations: CitationResponse[]; // FR-006 설명가능성
}
