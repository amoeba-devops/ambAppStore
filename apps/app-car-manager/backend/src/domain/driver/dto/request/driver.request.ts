import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';
import { DriverRole } from '../../../../common/constants/enums';

export class CreateDriverRequest {
  @IsUUID()
  @IsOptional()
  vehicle_id?: string;

  @IsUUID()
  @IsNotEmpty()
  ama_user_id: string;

  @IsString()
  @IsOptional()
  driver_name?: string;

  @IsString()
  @IsOptional()
  driver_email?: string;

  @IsEnum(DriverRole)
  @IsNotEmpty()
  role: DriverRole;

  @IsString()
  @IsOptional()
  note?: string;
}

export class UpdateDriverRequest {
  @IsUUID()
  @IsOptional()
  vehicle_id?: string | null;

  @IsEnum(DriverRole)
  @IsOptional()
  role?: DriverRole;

  @IsString()
  @IsOptional()
  note?: string;
}

export class UpdateDriverStatusRequest {
  @IsString()
  @IsNotEmpty()
  status: string;

  @IsDateString()
  @IsOptional()
  leave_start?: string;

  @IsDateString()
  @IsOptional()
  leave_end?: string;
}

export class AssignDriverRequest {
  @IsUUID()
  @IsNotEmpty()
  vehicle_id: string;
}
