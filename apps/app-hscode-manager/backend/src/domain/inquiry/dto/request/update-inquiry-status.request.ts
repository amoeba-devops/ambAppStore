import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const INQUIRY_STATUSES = [
  'DRAFT',
  'INTAKE',
  'MATCHING',
  'REVIEWING',
  'RESPONDED',
  'VERIFIED',
  'DISPUTED',
] as const;

export type InquiryStatusValue = (typeof INQUIRY_STATUSES)[number];

export class UpdateInquiryStatusRequest {
  @ApiProperty({ enum: INQUIRY_STATUSES })
  @IsIn(INQUIRY_STATUSES as readonly string[])
  status: InquiryStatusValue;
}
