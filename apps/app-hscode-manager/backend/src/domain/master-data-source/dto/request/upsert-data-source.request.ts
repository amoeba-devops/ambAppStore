import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateDataSourceRequest {
  @ApiProperty({ example: 'bieu_thue_xnk_2026' })
  @IsString()
  @Length(1, 64)
  @Matches(/^[a-z0-9_]+$/, { message: 'adapter_key must be snake_case (lowercase + digits + underscore)' })
  adapter_key: string;

  @ApiProperty({ example: 'VN' })
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/)
  import_country_code: string;

  @ApiProperty()
  @IsString()
  @Length(1, 255)
  display_name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  endpoint_url?: string;

  @ApiPropertyOptional({ default: 86400 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(604800)
  cache_ttl_sec?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class UpdateDataSourceRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 255)
  display_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  endpoint_url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(604800)
  cache_ttl_sec?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
