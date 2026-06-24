export type ExpertRole = 'EXPERT_LOCAL' | 'EXPERT_INTERNAL';
export type ReviewVerdict = 'PENDING' | 'APPROVE' | 'REVISE' | 'REJECT';

export type EscalationTriggerReason =
  | 'LOW_CONFIDENCE'
  | 'MULTIPLE_CANDIDATES'
  | 'PROHIBITED_KEYWORD'
  | 'PAST_SEIZURE'
  | 'CUSTOMER_REQUEST'
  | 'AMOUNT_THRESHOLD'
  | 'OTHER_CATEGORY'
  | 'CUSTOMS_SEIZURE_AUTO';

export interface ExpertReview {
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
  context?: {
    hsCode?: string;
    itemName?: string;
    category?: string;
    importCountryCode?: string | null;
    exportCountryCode?: string | null;
  };
}
