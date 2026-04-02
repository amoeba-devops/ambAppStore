import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsIn, IsObject } from 'class-validator';

const CATEGORIES = ['AI', 'EMAIL', 'STORAGE', 'MARKETPLACE', 'ERP', 'PLATFORM'];

export class CreateAdminIntegrationDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(CATEGORIES)
  category: string;

  @IsString()
  @IsNotEmpty()
  service_code: string;

  @IsString()
  @IsNotEmpty()
  service_name: string;

  @IsOptional()
  @IsString()
  endpoint?: string;

  @IsOptional()
  @IsString()
  key_name?: string;

  @IsOptional()
  @IsString()
  key_value?: string;

  @IsOptional()
  @IsObject()
  extra_config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateAdminIntegrationDto {
  @IsOptional()
  @IsString()
  @IsIn(CATEGORIES)
  category?: string;

  @IsOptional()
  @IsString()
  service_code?: string;

  @IsOptional()
  @IsString()
  service_name?: string;

  @IsOptional()
  @IsString()
  endpoint?: string;

  @IsOptional()
  @IsString()
  key_name?: string;

  @IsOptional()
  @IsString()
  key_value?: string;

  @IsOptional()
  @IsObject()
  extra_config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
