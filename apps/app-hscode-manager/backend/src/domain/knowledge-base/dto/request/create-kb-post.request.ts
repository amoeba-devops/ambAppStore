import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const KB_LANGS = ['ko', 'en', 'vi', 'id'];

/** 게시글 생성 요청 (snake_case, 단일 언어 작성). FR-KB-003/008 */
export class CreateKbPostRequest {
  @ApiProperty({ description: '제목' })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  pst_title: string;

  @ApiProperty({ description: '본문' })
  @IsString()
  @MinLength(1)
  pst_content: string;

  @ApiPropertyOptional({ description: '작성 언어', enum: KB_LANGS, default: 'ko' })
  @IsOptional()
  @IsString()
  @IsIn(KB_LANGS)
  pst_source_lang?: string;

  @ApiPropertyOptional({ description: '카테고리 ID' })
  @IsOptional()
  @IsUUID()
  pst_category_id?: string;

  @ApiPropertyOptional({ description: '상단 고정 여부', default: false })
  @IsOptional()
  @IsBoolean()
  pst_is_pinned?: boolean;

  @ApiPropertyOptional({ description: '태그 ID 배열' })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  tag_ids?: string[];
}
