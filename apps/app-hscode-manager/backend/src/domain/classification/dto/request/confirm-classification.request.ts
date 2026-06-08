import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';

const SOURCES = ['INTERNAL', 'EXTERNAL', 'AI', 'MIXED'] as const;

export class CandidateSnapshot {
  @ApiProperty()
  @IsString()
  @Length(1, 16)
  hs_code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  basic_tariff_rate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  fta_tariff_rate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fta_agreement_code?: string;

  @ApiProperty({ enum: SOURCES })
  @IsIn(SOURCES as readonly string[])
  source: (typeof SOURCES)[number];

  @ApiProperty()
  @IsNumber()
  @Min(1)
  ranking: number;

  @ApiProperty()
  @IsNumber()
  confidence: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reasoning?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  source_citations?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  external_adapter_keys?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  flags?: Record<string, boolean>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  past_adoption_count?: number;
}

export class ConfirmClassificationRequest {
  @ApiProperty()
  @IsUUID()
  inquiry_id: string;

  @ApiProperty()
  @IsUUID()
  item_id: string;

  @ApiProperty({ description: '사용자가 선택한 hsCode' })
  @IsString()
  @Length(1, 16)
  selected_hs_code: string;

  @ApiPropertyOptional({
    description:
      '과거 채택과 다른 선택을 한 경우 사유 필수 (FR-CO-02). 그 외 선택 사항.',
  })
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  selection_rationale?: string;

  @ApiPropertyOptional({
    description:
      '중복 감지 시 기존 레코드 갱신(true) vs 신규 생성(false). 첫 호출은 false 권장.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  overwrite_existing?: boolean;

  @ApiProperty({
    description:
      '매칭 결과 스냅샷. Phase 3 matching/run 응답의 candidates 배열을 그대로 전달.',
    type: [CandidateSnapshot],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CandidateSnapshot)
  candidates: CandidateSnapshot[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ai_model_version?: string;
}
