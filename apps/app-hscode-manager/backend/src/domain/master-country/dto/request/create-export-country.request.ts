import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateExportCountryRequest {
  @ApiProperty({ example: 'KR' })
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/)
  code: string;

  @ApiProperty({ example: '한국' })
  @IsString()
  @Length(1, 100)
  name_ko: string;

  @ApiProperty({ example: 'South Korea' })
  @IsString()
  @Length(1, 100)
  name_en: string;

  @ApiProperty({ example: 'Hàn Quốc' })
  @IsString()
  @Length(1, 100)
  name_vi: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
