import type { RankedCandidate } from '../../service/ranker.service';

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

export interface MatchingRunResponse {
  inquiryId: string;
  itemId: string;
  candidates: RankedCandidate[];
  warnings: string[];
  metadata: MatchingMetadata;
}
