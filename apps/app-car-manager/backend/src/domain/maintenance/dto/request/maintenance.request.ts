import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, IsDateString, IsInt, Min } from 'class-validator';
import { MaintenanceType } from '../../../../common/constants/enums';

export class CreateMaintenanceRequest {
  @IsUUID()
  @IsNotEmpty()
  vehicle_id: string;

  @IsEnum(MaintenanceType)
  @IsNotEmpty()
  type: MaintenanceType;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  shop_name?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  cost?: number;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsDateString()
  @IsOptional()
  next_date?: string;
}

export class UpdateMaintenanceRequest {
  @IsEnum(MaintenanceType)
  @IsOptional()
  type?: MaintenanceType;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  shop_name?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  cost?: number;

  @IsDateString()
  @IsOptional()
  date?: string;

  @IsDateString()
  @IsOptional()
  next_date?: string;
}
