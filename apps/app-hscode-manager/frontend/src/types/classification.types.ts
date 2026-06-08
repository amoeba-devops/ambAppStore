import type { CandidateSource } from './matching.types';

export type ClassificationStatus =
  | 'PROPOSED'
  | 'ADOPTED'
  | 'SEALED'
  | 'SUPERSEDED'
  | 'DISPUTED';

export interface ClassificationCandidate {
  id: string;
  hsCode: string;
  description: string | null;
  basicTariffRate: number | null;
  ftaTariffRate: number | null;
  ftaAgreementCode: string | null;
  source: CandidateSource;
  ranking: number;
  confidence: number | null;
  reasoning: string | null;
  sourceCitations: string[];
  externalAdapterKeys: string[];
  flags: Record<string, boolean> | null;
  pastAdoptionCount: number;
}

export interface Classification {
  id: string;
  inquiryId: string;
  itemId: string;
  hsCode: string;
  basicTariffRate: number | null;
  ftaTariffRate: number | null;
  ftaAgreementCode: string | null;
  confidenceScore: number | null;
  status: ClassificationStatus;
  recommendationSource: CandidateSource | null;
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
  candidates?: ClassificationCandidate[];
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
  historyIds?: string[];
}

export interface PaginatedClassifications {
  items: Classification[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ResponseFormResult {
  classificationId: string;
  channel: 'email' | 'kakao' | 'messenger' | 'plain';
  language: 'ko' | 'en' | 'vi';
  subject: string;
  body: string;
  variables: Record<string, string>;
}
