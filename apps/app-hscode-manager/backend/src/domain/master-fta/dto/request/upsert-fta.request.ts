import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class CreateFtaRequest {
  @ApiProperty({ example: 'VN' })
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/)
  import_country_code: string;

  @ApiProperty({ example: 'KR' })
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/)
  export_country_code: string;

  @ApiProperty({ example: 'VKFTA' })
  @IsString()
  @Length(1, 16)
  agreement_code: string;

  @ApiProperty({ example: '7220.20.10' })
  @IsString()
  @Length(1, 16)
  hs_code: string;

  @ApiProperty({ example: '0.000' })
  @IsNumberString()
  rate: string;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  effective_from: string;

  @ApiPropertyOptional({ example: '2030-12-31' })
  @IsOptional()
  @IsDateString()
  effective_to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  memo?: string;
}

export class UpdateFtaRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  rate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effective_to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  memo?: string;
}
