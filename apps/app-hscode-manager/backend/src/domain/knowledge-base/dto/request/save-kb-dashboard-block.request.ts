import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const KB_BLOCK_TYPES = ['NOTICE', 'TIP'];

/** 대시보드 블록 생성/수정 요청. FR-KB-005/006 */
export class SaveKbDashboardBlockRequest {
  @ApiProperty({ description: '블록 유형', enum: KB_BLOCK_TYPES })
  @IsString()
  @IsIn(KB_BLOCK_TYPES)
  dsb_block_type: string;

  @ApiPropertyOptional({ description: '제목' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  dsb_title?: string;

  @ApiPropertyOptional({ description: '본문' })
  @IsOptional()
  @IsString()
  dsb_body?: string;

  @ApiPropertyOptional({ description: '플래그 라벨(팁 카드)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  dsb_flag_label?: string;

  @ApiPropertyOptional({ description: '정렬 순서', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  dsb_sort_order?: number;

  @ApiPropertyOptional({ description: '활성 여부', default: true })
  @IsOptional()
  @IsBoolean()
  dsb_is_active?: boolean;
}
