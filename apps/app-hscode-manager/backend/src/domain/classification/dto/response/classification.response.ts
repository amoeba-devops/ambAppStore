import type {
  ClassificationStatus,
  RecommendationSource,
} from '../../entity/classification.entity';

export class ClassificationCandidateResponse {
  id: string;
  hsCode: string;
  description: string | null;
  basicTariffRate: number | null;
  ftaTariffRate: number | null;
  ftaAgreementCode: string | null;
  source: RecommendationSource;
  ranking: number;
  confidence: number | null;
  reasoning: string | null;
  sourceCitations: string[];
  externalAdapterKeys: string[];
  flags: Record<string, boolean> | null;
  pastAdoptionCount: number;
}

export class ClassificationResponse {
  id: string;
  inquiryId: string;
  itemId: string;
  hsCode: string;
  basicTariffRate: number | null;
  ftaTariffRate: number | null;
  ftaAgreementCode: string | null;
  confidenceScore: number | null;
  status: ClassificationStatus;
  recommendationSource: RecommendationSource | null;
  aiReasoning: string | null;
  aiModelVersion: string | null;
  externalSources: unknown[] | null;
  selectionRationale: string | null;
  adoptedAt: string | null;
  supersededAt: string | null;
  supersededById: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  candidates?: ClassificationCandidateResponse[];
  /** S10/S11 보강용 — 조인된 inquiry / item / exporter 요약 */
  inquiry?: {
    exporterId: string | null;
    exporterName?: string | null;
    exportCountryCode: string | null;
    importCountryCode: string | null;
    submittedAt: string | null;
  };
  item?: {
    nameRaw: string;
    category: string;
    compositionHash: string | null;
  };
}
