import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

const EVENT_TYPES = [
  'SAMPLE_ANALYSIS',
  'CUSTOMS_SEIZURE',
  'CUSTOMS_DOUBLE_CHECK',
] as const;

const RESULTS = ['MATCH', 'MISMATCH', 'CONFIRMED'] as const;

export class CreateVerificationRequest {
  @ApiProperty()
  @IsUUID()
  classification_id: string;

  @ApiProperty({ enum: EVENT_TYPES })
  @IsEnum(EVENT_TYPES)
  event_type: (typeof EVENT_TYPES)[number];

  @ApiProperty({ example: '2026-05-13' })
  @IsDateString()
  event_date: string;

  @ApiPropertyOptional({
    enum: RESULTS,
    description:
      'SAMPLE_ANALYSIS: MATCH/MISMATCH. CUSTOMS_DOUBLE_CHECK: CONFIRMED. CUSTOMS_SEIZURE: 생략 가능.',
  })
  @IsOptional()
  @IsEnum(RESULTS)
  result?: (typeof RESULTS)[number];

  @ApiPropertyOptional({
    description: 'CUSTOMS_SEIZURE 시 추징 금액(USD)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount_usd?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  notes?: string;
}
