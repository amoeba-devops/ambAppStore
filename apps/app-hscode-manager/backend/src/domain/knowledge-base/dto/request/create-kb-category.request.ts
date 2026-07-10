import { IsInt, IsOptional, IsString, MaxLength, MinLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** 카테고리 생성/수정 요청 (snake_case). FR-KB-015 */
export class CreateKbCategoryRequest {
  @ApiProperty({ description: '카테고리 이름' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  cat_name: string;

  @ApiPropertyOptional({ description: '정렬 순서', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  cat_sort_order?: number;

  @ApiPropertyOptional({ description: 'UI 표시 색상(예: #3B82F6)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  cat_dot_color?: string;
}
