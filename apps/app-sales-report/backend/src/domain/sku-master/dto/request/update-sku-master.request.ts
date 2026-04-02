import { IsString, IsOptional, MaxLength, IsNumber, Min, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSkuMasterRequest {
  @IsOptional() @IsString() @MaxLength(200)
  name_kr?: string;

  @IsOptional() @IsString() @MaxLength(200)
  name_en?: string;

  @IsOptional() @IsString() @MaxLength(200)
  name_vi?: string;

  @IsOptional() @IsString() @MaxLength(50)
  variant_type?: string;

  @IsOptional() @IsString() @MaxLength(100)
  variant_value?: string;

  @IsOptional() @IsString() @MaxLength(50)
  sync_code?: string;

  @IsOptional() @IsString() @MaxLength(20)
  gtin_code?: string;

  @IsOptional() @IsString() @MaxLength(20)
  hs_code?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  prime_cost?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  supply_price?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  listing_price?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  selling_price?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  fulfillment_fee_override?: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  weight_gram?: number;

  @IsOptional() @IsString() @MaxLength(10)
  unit?: string;

  @IsOptional() @IsBoolean()
  is_active?: boolean;

  @IsOptional() @IsString() @MaxLength(200)
  cost_change_memo?: string;
}
