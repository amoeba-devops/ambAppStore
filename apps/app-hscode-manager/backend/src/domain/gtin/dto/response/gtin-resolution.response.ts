export type LayerStatus = 'hit' | 'miss' | 'done' | 'chosen' | 'unused';

export class PipelineLayer {
  key: 'L1' | 'L2' | 'L3' | 'L4';
  status: LayerStatus;
}

export class GtinResolutionResponse {
  gtin14: string;
  country: string;
  // RESOLVED | NOT_FOUND (L1 miss, 외부 레이어 미사용) | PENDING_REVIEW
  status: 'RESOLVED' | 'NOT_FOUND' | 'PENDING_REVIEW';
  hs6: string | null;
  hsCode: string | null; // 국가 확장 full code (8~10)
  dutyRate: number | null;
  description: string | null;
  source: string | null; // DIRECT | LEARNED | MANUAL ...
  confidence: number | null;
  countryDigitsAvailable: boolean; // 국가 확장행 존재 여부
  layers: PipelineLayer[];
}
