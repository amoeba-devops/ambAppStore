import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export class CreateInquiryRequest {
  @ApiProperty({ description: '수출업체 ID (Exporter)' })
  @IsUUID()
  exporter_id: string;

  @ApiProperty({ example: 'KR', description: 'ISO 3166-1 alpha-2' })
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/)
  export_country_code: string;

  @ApiProperty({ example: 'VN' })
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/)
  import_country_code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  memo?: string;
}
