import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** 지식 검색 요청 — 매칭/Q&A 근거 회수 검증용(Phase 1). */
export class SearchKnowledgeRequest {
  @ApiProperty({ description: '질의 텍스트' })
  @IsString()
  @MinLength(1)
  query: string;

  @ApiPropertyOptional({ description: '반환 개수(기본 5)', default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  top_n?: number;
}
