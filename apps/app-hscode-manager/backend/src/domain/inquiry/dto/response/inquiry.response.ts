import { InquiryStatus } from '../../entity/inquiry.entity';

export class InquiryResponse {
  id: string;
  exporterId: string | null;
  exportCountryCode: string | null;
  importCountryCode: string | null;
  title: string | null;
  memo: string | null;
  status: InquiryStatus;
  completenessScore: number | null;
  submittedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  warnings?: string[];
}
