import { IsString, IsNotEmpty, IsOptional, IsIn, IsBoolean, MaxLength } from 'class-validator';

const CATEGORIES = ['AI', 'EMAIL', 'STORAGE', 'MARKETPLACE', 'ERP', 'PLATFORM'];

export class CreateExternalIntegrationRequest {
  @IsString()
  @IsNotEmpty()
  @IsIn(CATEGORIES)
  category: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  service_code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  service_name: string;

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
