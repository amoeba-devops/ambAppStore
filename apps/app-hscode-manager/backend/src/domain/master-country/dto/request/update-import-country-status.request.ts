import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

const SUPPORT_STATUSES = ['ACTIVE', 'BETA', 'NOT_SUPPORTED'] as const;

export class UpdateImportCountryStatusRequest {
  @ApiProperty({ enum: SUPPORT_STATUSES })
  @IsEnum(SUPPORT_STATUSES)
  support_status: (typeof SUPPORT_STATUSES)[number];

  @ApiPropertyOptional({
    description: '어댑터 키 — ACTIVE/BETA 승격 시 필수. NOT_SUPPORTED 강등 시 null 가능.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  adapter_key?: string;
}
