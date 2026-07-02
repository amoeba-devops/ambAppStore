export type VerificationEventType =
  | 'SAMPLE_ANALYSIS'
  | 'CUSTOMS_SEIZURE'
  | 'CUSTOMS_DOUBLE_CHECK';

export type VerificationResult = 'MATCH' | 'MISMATCH' | 'CONFIRMED';

export type ReviewTargetType = 'ITEM' | 'CLASSIFICATION';

export type ReviewReason =
  | 'SAMPLE_MISMATCH'
  | 'CUSTOMS_SEIZURE_DIRECT'
  | 'CUSTOMS_SEIZURE_PATTERN'
  | 'MANUAL'
  | 'DISPUTED_CHAIN';

export interface VerificationEvent {
  id: string;
  classificationId: string;
  inquiryId: string | null;
  eventType: VerificationEventType;
  eventDate: string;
  result: VerificationResult | null;
  confidenceDelta: number | null;
  amountUsd: number | null;
  notes: string | null;
  followUpActions: unknown[] | null;
  createdBy: string | null;
  createdAt: string;
}

export interface ReviewQueueItem {
  id: string;
  targetType: ReviewTargetType;
  targetId: string;
  triggerEventId: string | null;
  reason: ReviewReason;
  priority: number;
  resolvedAt: string | null;
  resolvedBy: string | null;
  notes: string | null;
  createdAt: string;
  targetSummary?: {
    hsCode?: string;
    itemName?: string;
    inquiryId?: string;
  };
}

export interface KpiSummary {
  periodMonths: number;
  totalAdopted: number;
  totalSuperseded: number;
  totalSealed: number;
  totalDisputed: number;
  totalSeizure: number;
  totalSampleAnalysis: number;
  seizureRate: number;
  correctionRate: number;
  sealedRate: number;
  totalSeizureAmountUsd: number;
}
