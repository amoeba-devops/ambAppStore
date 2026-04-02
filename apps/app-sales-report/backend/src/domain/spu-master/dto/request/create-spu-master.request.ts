import { IsString, IsNotEmpty, MaxLength, IsOptional, IsBoolean } from 'class-validator';

export class CreateSpuMasterRequest {
  @IsString() @IsNotEmpty() @MaxLength(7)
  spu_code: string;

  @IsString() @IsNotEmpty() @MaxLength(10)
  brand_code: string;

  @IsOptional() @IsString() @MaxLength(20)
  sub_brand?: string;

  @IsString() @IsNotEmpty() @MaxLength(200)
  name_kr: string;

  @IsString() @IsNotEmpty() @MaxLength(200)
  name_en: string;

  @IsString() @IsNotEmpty() @MaxLength(200)
  name_vi: string;

  @IsOptional() @IsString() @MaxLength(20)
  category_code?: string;

  @IsOptional() @IsString() @MaxLength(100)
  category_name?: string;
}
