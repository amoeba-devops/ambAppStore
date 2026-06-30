export type LayerStatus = 'hit' | 'miss' | 'done' | 'chosen' | 'unused';

export interface PipelineLayer {
  key: 'L1' | 'L2' | 'L3' | 'L4';
  status: LayerStatus;
}

export interface GtinResolution {
  gtin14: string;
  country: string;
  status: 'RESOLVED' | 'NOT_FOUND' | 'PENDING_REVIEW';
  hs6: string | null;
  hsCode: string | null;
  dutyRate: number | null;
  description: string | null;
  source: string | null;
  confidence: number | null;
  countryDigitsAvailable: boolean;
  layers: PipelineLayer[];
}

export interface ResolveGtinPayload {
  gtin: string;
  country: string;
}
