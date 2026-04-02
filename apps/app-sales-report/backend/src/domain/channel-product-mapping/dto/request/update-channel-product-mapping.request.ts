import { IsString, IsOptional, MaxLength, IsNumber, Min, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateChannelProductMappingRequest {
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

  @IsOptional() @IsBoolean()
  is_active?: boolean;
}
