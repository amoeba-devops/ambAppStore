import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class CreateExporterRequest {
  @ApiProperty({ example: 'ABC Manufacturing Co., Ltd.' })
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiProperty({ example: 'KR', description: 'ISO 3166-1 alpha-2' })
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/)
  country_code: string;

  @ApiPropertyOptional({
    type: [String],
    description: '동일 업체의 다른 표기',
    example: ['ABC Mfg.', 'ABC Korea'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  aliases?: string[];

  @ApiPropertyOptional({
    description: '리스크 플래그 JSON (자유 형식)',
    example: { strict_check: true, memo: '신규 거래처' },
  })
  @IsOptional()
  @IsObject()
  risk_flags?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  memo?: string;
}
