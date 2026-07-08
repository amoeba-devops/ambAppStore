import { IsInt, IsNumber, IsOptional, IsString, Length, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertGtinMapRequest {
  @ApiProperty()
  @IsString()
  @MaxLength(14)
  gtin: string;

  @ApiProperty()
  @IsString()
  @MaxLength(6)
  hs6: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8)
  gpc_brick?: string;
}

export class UpsertGpcMapRequest {
  @ApiProperty()
  @IsString()
  @MaxLength(8)
  gpc_brick: string;

  @ApiProperty()
  @IsString()
  @MaxLength(6)
  hs6: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number;
}

export class UpsertCountryExtRequest {
  @ApiProperty()
  @IsString()
  @MaxLength(6)
  hs6: string;

  @ApiProperty({ example: 'VN' })
  @IsString()
  @Length(2, 2)
  country: string;

  @ApiProperty({ example: '4016.93.00' })
  @IsString()
  @MaxLength(12)
  hs_full: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  duty_rate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
