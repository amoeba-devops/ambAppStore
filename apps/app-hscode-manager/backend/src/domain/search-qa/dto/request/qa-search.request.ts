import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchConstraintsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  material?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  usage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  processing?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  origin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;
}

export class QaSearchRequest {
  @ApiProperty({ description: '자연어 제품 설명 (KR/EN/VI)' })
  @IsString()
  @MinLength(2) // FR-001: 2자 미만 거부
  @MaxLength(500)
  query_text: string;

  @ApiPropertyOptional({ description: '명확화 라운드 번호 (0부터)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  round_count?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  session_id?: string;

  @ApiPropertyOptional({ type: SearchConstraintsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SearchConstraintsDto)
  constraints?: SearchConstraintsDto;
}
