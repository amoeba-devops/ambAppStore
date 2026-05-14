export type CandidateSource = 'INTERNAL' | 'EXTERNAL' | 'AI' | 'MIXED';

export interface RankedCandidate {
  hsCode: string;
  description: string | null;
  basicTariffRate: number | null;
  ftaTariffRate: number | null;
  ftaAgreementCode: string | null;
  confidence: number;
  source: CandidateSource;
  ranking: number;
  reasoning: string;
  sourceCitations: string[];
  pastAdoptionCount: number;
  externalAdapterKeys: string[];
  flags: {
    conservativeTariffApplied?: boolean;
    sampleAnalysisRecommended?: boolean;
    requiresSampleAnalysis?: boolean;
    aiHallucinationDiscarded?: boolean;
    disputedHistory?: boolean;
  };
}

export interface MatchingMetadata {
  internalCount: number;
  externalCalled: boolean;
  externalCacheUsed: boolean;
  externalDegraded: boolean;
  aiCalled: boolean;
  aiStatus: string | null;
  aiHallucinatedCount: number;
  internalSkipExternal: boolean;
  durationMs: {
    total: number;
    internal: number;
    external: number;
    ai: number;
    rank: number;
  };
}

export interface MatchingRunResult {
  inquiryId: string;
  itemId: string;
  candidates: RankedCandidate[];
  warnings: string[];
  metadata: MatchingMetadata;
}
