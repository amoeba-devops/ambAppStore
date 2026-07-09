import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const DOC_TYPES = [
  'LAW',
  'GUIDE',
  'CASE_STUDY',
  'TECHNICAL',
  'SPEC_SHEET',
  'SYSTEM',
  'ADVANCE_RULING',
  'LEARNED',
  'HS_TABLE',
];

/** 지식 문서 적재 요청 (Phase 1 RAG 구축) — 본문을 청킹·임베딩해 hsm_doc_chunks에 저장. */
export class CreateKnowledgeDocumentRequest {
  @ApiProperty({ description: '문서 유형', enum: DOC_TYPES })
  @IsString()
  @IsIn(DOC_TYPES)
  doc_type: string;

  @ApiProperty({ description: '문서 제목' })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title: string;

  @ApiProperty({ description: '문서 본문(청킹 대상)' })
  @IsString()
  @MinLength(1)
  body: string;

  @ApiPropertyOptional({ description: '출처 국가(VN/KR/CN/US)' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  source_country?: string;

  @ApiPropertyOptional({ description: '출처 기관' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  source_org?: string;

  @ApiPropertyOptional({ description: '언어(ko/en/vi)', default: 'ko' })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  language?: string;

  @ApiPropertyOptional({ description: 'HS 버전' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  hs_version?: string;

  @ApiPropertyOptional({ description: '신뢰등급', enum: ['OFFICIAL', 'QUASI_OFFICIAL', 'REFERENCE'] })
  @IsOptional()
  @IsString()
  @IsIn(['OFFICIAL', 'QUASI_OFFICIAL', 'REFERENCE'])
  reliability_grade?: string;

  @ApiPropertyOptional({ description: '공식 문서 여부' })
  @IsOptional()
  @IsBoolean()
  is_official?: boolean;

  @ApiPropertyOptional({ description: '장(chapter) 태그 배열' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  chapter_tags?: string[];

  @ApiPropertyOptional({ description: '소재(material) 태그 배열' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  material_tags?: string[];
}
