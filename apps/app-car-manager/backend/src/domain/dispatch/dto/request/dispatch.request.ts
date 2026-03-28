import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
  IsBoolean,
  IsInt,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { DispatchPurposeType } from '../../../../common/constants/enums';

export class CreateDispatchRequest {
  @IsEnum(DispatchPurposeType)
  @IsNotEmpty()
  purpose_type: DispatchPurposeType;

  @IsString()
  @IsNotEmpty()
  purpose: string;

  @IsDateString()
  @IsNotEmpty()
  depart_at: string;

  @IsDateString()
  @IsNotEmpty()
  return_at: string;

  @IsString()
  @IsNotEmpty()
  origin: string;

  @IsString()
  @IsNotEmpty()
  destination: string;

  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  passenger_count?: number;

  @IsArray()
  @IsOptional()
  passenger_list?: string[];

  @IsString()
  @IsOptional()
  preferred_vehicle_type?: string;

  @IsString()
  @IsOptional()
  cargo_info?: string;

  @IsBoolean()
  @IsOptional()
  is_proxy?: boolean;

  @IsString()
  @IsOptional()
  actual_user_name?: string;

  @IsString()
  @IsOptional()
  note?: string;
}

export class ApproveDispatchRequest {
  @IsUUID()
  @IsNotEmpty()
  vehicle_id: string;

  @IsUUID()
  @IsOptional()
  driver_id?: string;
}

export class RejectDispatchRequest {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class DriverRespondRequest {
  @IsBoolean()
  @IsNotEmpty()
  accepted: boolean;

  @IsString()
  @IsOptional()
  reject_reason?: string;
}

export class CancelDispatchRequest {
  @IsString()
  @IsNotEmpty()
  reason: string;
}
