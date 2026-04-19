import { IsOptional, IsString, IsInt, IsNumber, IsBoolean, IsDateString, IsEnum, IsUUID, Min, Max } from 'class-validator';
import { KrPurposeCode } from '../../../../common/constants/enums';

export class CreateTripLogRequest {
  @IsUUID()
  vehicle_id: string;

  @IsUUID()
  driver_id: string;

  @IsString()
  origin: string;

  @IsString()
  destination: string;

  @IsDateString()
  @IsOptional()
  depart_actual?: string;

  @IsDateString()
  @IsOptional()
  arrive_actual?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  odo_start?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  odo_end?: number;

  @IsString()
  @IsOptional()
  customer_name?: string;

  @IsString()
  @IsOptional()
  bill_no?: string;

  @IsString()
  @IsOptional()
  cdf_no?: string;

  @IsBoolean()
  @IsOptional()
  refueled?: boolean;

  @IsNumber()
  @Min(0)
  @IsOptional()
  fuel_amount?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  fuel_cost?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  toll_cost?: number;

  @IsBoolean()
  @IsOptional()
  has_accident?: boolean;

  @IsString()
  @IsOptional()
  note?: string;

  @IsEnum(KrPurposeCode)
  @IsOptional()
  kr_purpose_code?: KrPurposeCode;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  kr_business_ratio?: number;
}
