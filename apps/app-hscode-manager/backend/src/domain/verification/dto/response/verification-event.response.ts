import type {
  VerificationEventType,
  VerificationResult,
} from '../../entity/verification-event.entity';

export class VerificationEventResponse {
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

export class ReviewQueueItemResponse {
  id: string;
  targetType: 'ITEM' | 'CLASSIFICATION';
  targetId: string;
  triggerEventId: string | null;
  reason: string;
  priority: number;
  resolvedAt: string | null;
  resolvedBy: string | null;
  notes: string | null;
  createdAt: string;
  /** 조인된 요약 정보 (옵션) */
  targetSummary?: {
    hsCode?: string;
    itemName?: string;
    inquiryId?: string;
  };
}

export class KpiSummary {
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
