import { IsString, IsOptional, MaxLength, IsBoolean } from 'class-validator';

export class UpdateSpuMasterRequest {
  @IsOptional() @IsString() @MaxLength(10)
  brand_code?: string;

  @IsOptional() @IsString() @MaxLength(20)
  sub_brand?: string;

  @IsOptional() @IsString() @MaxLength(200)
  name_kr?: string;

  @IsOptional() @IsString() @MaxLength(200)
  name_en?: string;

  @IsOptional() @IsString() @MaxLength(200)
  name_vi?: string;

  @IsOptional() @IsString() @MaxLength(20)
  category_code?: string;

  @IsOptional() @IsString() @MaxLength(100)
  category_name?: string;

  @IsOptional() @IsBoolean()
  is_active?: boolean;
}
