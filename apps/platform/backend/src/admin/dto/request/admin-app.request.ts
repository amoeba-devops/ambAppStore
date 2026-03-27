import { IsNotEmpty, IsOptional, IsString, IsEnum, MaxLength, IsInt, Min, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { AppStatus } from '../../platform-app/entities/app.entity';

export class CreateAppDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  app_slug: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  app_name: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  app_name_en?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  app_short_desc?: string;

  @IsOptional()
  @IsString()
  app_description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  app_icon_url?: string;

  @IsOptional()
  @IsArray()
  app_screenshots?: string[];

  @IsOptional()
  @IsArray()
  app_features?: Array<{ icon: string; label: string }>;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  app_category?: string;

  @IsOptional()
  @IsEnum(AppStatus)
  app_status?: AppStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  app_sort_order?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  app_port_fe?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  app_port_be?: number;
}

export class UpdateAppDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  app_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  app_name_en?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  app_short_desc?: string;

  @IsOptional()
  @IsString()
  app_description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  app_icon_url?: string;

  @IsOptional()
  @IsArray()
  app_screenshots?: string[];

  @IsOptional()
  @IsArray()
  app_features?: Array<{ icon: string; label: string }>;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  app_category?: string;

  @IsOptional()
  @IsEnum(AppStatus)
  app_status?: AppStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  app_sort_order?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  app_port_fe?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  app_port_be?: number;
}
