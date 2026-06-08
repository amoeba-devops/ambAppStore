import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

const SUPPORT_STATUSES = ['ACTIVE', 'BETA', 'NOT_SUPPORTED'] as const;

export class CreateImportCountryRequest {
  @ApiProperty({ example: 'VN', description: 'ISO 3166-1 alpha-2' })
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/, { message: 'code must be 2 uppercase letters' })
  code: string;

  @ApiProperty({ example: '베트남' })
  @IsString()
  @Length(1, 100)
  name_ko: string;

  @ApiProperty({ example: 'Vietnam' })
  @IsString()
  @Length(1, 100)
  name_en: string;

  @ApiProperty({ example: 'Việt Nam' })
  @IsString()
  @Length(1, 100)
  name_vi: string;

  @ApiProperty({
    enum: SUPPORT_STATUSES,
    default: 'NOT_SUPPORTED',
    required: false,
  })
  @IsOptional()
  @IsEnum(SUPPORT_STATUSES)
  support_status?: (typeof SUPPORT_STATUSES)[number];

  @ApiProperty({ required: false, example: 'bieu_thue_xnk_2026' })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  adapter_key?: string;

  @ApiProperty({ required: false, example: 'VND' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency_code?: string;

  @ApiProperty({ required: false, example: 'VND' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  default_tariff_currency?: string;
}
