import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** SCR-003 속성 폼 단건 분류 입력 (FR-030) */
export class ClassifyAttributeRequest {
  @ApiProperty({ description: '품명' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  material?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  usage?: string;

  @ApiPropertyOptional({ description: '가공 상태: finished | semi | raw' })
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
