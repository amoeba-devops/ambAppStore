import type { ExpertRole, ReviewVerdict } from '../../entity/expert-review.entity';

export class ExpertReviewResponse {
  id: string;
  classificationId: string;
  expertRole: ExpertRole;
  assignedUserId: string | null;
  triggerReason: string;
  triggerReasonList: string[];
  requestedAt: string | null;
  respondedAt: string | null;
  verdict: ReviewVerdict;
  notes: string | null;
  createdAt: string;
  /** 조인된 컨텍스트 (UI 표시용) */
  context?: {
    hsCode?: string;
    itemName?: string;
    category?: string;
    importCountryCode?: string | null;
    exportCountryCode?: string | null;
  };
}
