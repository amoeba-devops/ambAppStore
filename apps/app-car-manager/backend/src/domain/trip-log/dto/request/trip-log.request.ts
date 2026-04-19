import { IsOptional, IsString, IsUUID, IsInt, IsNumber, IsBoolean, IsDateString, IsEnum, Min, Max } from 'class-validator';
import { KrPurposeCode, TripLogStatus } from '../../../../common/constants/enums';

export class UpdateTripLogRequest {
  @IsUUID()
  @IsOptional()
  driver_id?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  passenger_count?: number;

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

  @IsNumber()
  @Min(0)
  @IsOptional()
  distance_km?: number;

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

export class SubmitTripLogRequest {
  @IsEnum(TripLogStatus)
  status: TripLogStatus;
}
