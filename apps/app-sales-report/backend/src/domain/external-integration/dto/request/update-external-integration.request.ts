import { IsString, IsOptional, IsIn, IsBoolean, MaxLength } from 'class-validator';

const CATEGORIES = ['AI', 'EMAIL', 'STORAGE', 'MARKETPLACE', 'ERP', 'PLATFORM'];

export class UpdateExternalIntegrationRequest {
  @IsOptional()
  @IsString()
  @IsIn(CATEGORIES)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  service_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  service_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  endpoint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  key_name?: string;

  @IsOptional()
  @IsString()
  key_value?: string;

  @IsOptional()
  extra_config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
