import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** FR-005 — 확정 분류 결과를 reference 코퍼스에 저장(Feature C 자기개선 루프). */
export class SaveReferenceEntryRequest {
  @ApiProperty({ description: '확정 HS코드 (8~10자리)' })
  @IsString()
  @MinLength(6)
  @MaxLength(12)
  hs_code: string;

  @ApiProperty({ description: '품명 (Tên hàng)' })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  description: string;

  @ApiPropertyOptional({ description: '원산지 (Xuất xứ)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  origin?: string;

  @ApiPropertyOptional({ description: '단위 (Đơn vị tính)' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  unit?: string;

  @ApiPropertyOptional({ description: '출처 회사' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  source_company?: string;
}
