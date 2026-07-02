import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

const CATEGORIES = ['CHEMICAL', 'STEEL_MECHANICAL', 'EQUIPMENT', 'OTHER'] as const;

/**
 * Excel 매핑 확정 후 import 요청.
 * 매핑된 파일은 multipart로 다시 업로드되거나, S3 등 임시 저장된 batch_id를 참조한다.
 * Phase 2 MVP 에서는 한 번에 파일+매핑을 모두 전송하는 단순 형태로 운영한다.
 */
export class ExcelImportRequest {
  @ApiProperty()
  @IsUUID()
  inquiry_id: string;

  @ApiProperty({ example: 'Sheet1' })
  @IsString()
  sheet: string;

  @ApiProperty({ example: 1, description: '헤더 행 번호 (1부터)' })
  @IsInt()
  @Min(1)
  header_row: number;

  @ApiPropertyOptional({ enum: CATEGORIES })
  @IsOptional()
  @IsEnum(CATEGORIES)
  category?: (typeof CATEGORIES)[number];

  @ApiProperty({
    description:
      '시스템 필드 → 엑셀 헤더명 매핑. null 인 필드는 spec_attributes(JSON)로 보존.',
    example: { name: 'Item Name', category: 'Type', material: 'Material' },
  })
  @IsObject()
  mapping: Record<string, string | null>;

  @ApiPropertyOptional({ description: '저장할 매핑 프로파일 이름 (다음 업로드 자동 제안용)' })
  @IsOptional()
  @IsString()
  profile_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  exporter_id?: string;
}

export class ExcelPreviewQuery {
  @ApiProperty({ default: 'Sheet1', required: false })
  @IsOptional()
  @IsString()
  sheet?: string;

  @ApiProperty({ default: 1, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  header_row?: number;
}
