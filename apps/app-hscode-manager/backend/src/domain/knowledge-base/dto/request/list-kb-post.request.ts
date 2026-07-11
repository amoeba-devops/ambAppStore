import { IsInt, IsOptional, IsString, IsUUID, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/** 게시글 목록/검색 쿼리 (snake_case query param). FR-KB-001/004 */
export class ListKbPostRequest {
  @ApiPropertyOptional({ description: '검색어(제목·본문·HS·태그)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ description: '카테고리 ID 필터' })
  @IsOptional()
  @IsUUID()
  category_id?: string;

  @ApiPropertyOptional({ description: '국가 태그 필터(예: VN)' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @ApiPropertyOptional({ description: '태그 ID 필터' })
  @IsOptional()
  @IsUUID()
  tag_id?: string;

  @ApiPropertyOptional({ description: '페이지(1-base)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: '페이지 크기', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page_size?: number;
}
