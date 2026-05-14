import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

const CATEGORIES = ['CHEMICAL', 'STEEL_MECHANICAL', 'EQUIPMENT', 'OTHER'] as const;

export class DirectIntakeRequest {
  @ApiProperty()
  @IsUUID()
  inquiry_id: string;

  @ApiProperty()
  @IsString()
  @Length(1, 500)
  name: string;

  @ApiProperty({ enum: CATEGORIES })
  @IsEnum(CATEGORIES)
  category: (typeof CATEGORIES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 5000)
  usage_description?: string;

  @ApiPropertyOptional({ description: '카테고리별 스펙 속성 JSON' })
  @IsOptional()
  @IsObject()
  spec_attributes?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 32)
  gtin?: string;

  @ApiPropertyOptional({ description: '첨부 파일 개수 (완성도 점수 보정용)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  attachment_count?: number;

  @ApiPropertyOptional({
    description: '완성도 < 0.7 일 때 강제 진행 사유 (없으면 soft block)',
  })
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  force_proceed_reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  force_proceed?: boolean;
}
