import { IsString, IsNotEmpty, MaxLength, IsOptional, IsNumber, Min, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateChannelProductMappingRequest {
  @IsString() @IsNotEmpty()
  sku_id: string;

  @IsString() @IsNotEmpty() @MaxLength(20)
  chn_code: string;

  @IsOptional() @IsString() @MaxLength(50)
  channel_product_id?: string;

  @IsOptional() @IsString() @MaxLength(50)
  channel_variation_id?: string;

  @IsOptional() @IsString() @MaxLength(300)
  channel_name_vi?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  listing_price?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  selling_price?: number;
}
