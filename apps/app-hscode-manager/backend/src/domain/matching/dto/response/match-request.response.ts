/** 요청건 요약 응답 (camelCase). SCR-5 이력. */
export class MatchRequestResponse {
  mrqId: string;
  fileName: string | null;
  sourceType: string;
  status: string;
  itemCount: number;
  matchedCount: number;
  reviewCount: number;
  confirmedCount: number;
  parseNote: string | null;
  createdAt: Date;
}

/** 품목별 추천 후보 응답. */
export class RecommendationResponse {
  recId: string;
  rank: number;
  hsVn: string;
  confidence: number; // 0..1
  reasoning: string;
  supportingChunks: string[];
  isEscalationRequired: boolean;
  finalUserAction: string | null;
}

/** 품목 + 추천 응답 (SCR-2 결과 행). */
export class MatchItemResponse {
  itemId: string;
  rowIndex: number | null;
  name: string | null;
  material: string | null;
  usage: string | null;
  status: string;
  needsReview: boolean;
  recommendations: RecommendationResponse[];
}

/** 요청건 상세 응답 (요청 + 품목 리스트). */
export class RequestDetailResponse {
  request: MatchRequestResponse;
  items: MatchItemResponse[];
}
