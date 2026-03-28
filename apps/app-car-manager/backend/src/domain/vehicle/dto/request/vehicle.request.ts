import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsInt,
  MaxLength,
  IsBoolean,
  IsNumber,
  Min,
} from 'class-validator';
import { VehicleType, FuelType, TransmissionType, CargoType, PurchaseType } from '../../../../common/constants/enums';

export class CreateVehicleRequest {
  @IsOptional()
  @IsString()
  ama_asset_id?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  plate_number: string;

  @IsEnum(VehicleType)
  type: VehicleType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  make: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  model: string;

  @IsInt()
  year: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  vin?: string;

  @IsOptional()
  @IsInt()
  displacement?: number;

  @IsEnum(FuelType)
  fuel_type: FuelType;

  @IsOptional()
  @IsEnum(TransmissionType)
  transmission?: TransmissionType;

  @IsInt()
  @Min(1)
  max_passengers: number;

  @IsOptional()
  @IsNumber()
  max_load_ton?: number;

  @IsOptional()
  @IsEnum(CargoType)
  cargo_type?: CargoType;

  @IsOptional()
  @IsEnum(PurchaseType)
  purchase_type?: PurchaseType;

  @IsOptional()
  @IsString()
  purchase_date?: string;

  @IsOptional()
  @IsNumber()
  purchase_price?: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateVehicleRequest {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  color?: string;

  @IsOptional()
  @IsInt()
  displacement?: number;

  @IsOptional()
  @IsEnum(TransmissionType)
  transmission?: TransmissionType;

  @IsOptional()
  @IsInt()
  @Min(1)
  max_passengers?: number;

  @IsOptional()
  @IsNumber()
  max_load_ton?: number;

  @IsOptional()
  @IsEnum(CargoType)
  cargo_type?: CargoType;

  @IsOptional()
  @IsEnum(PurchaseType)
  purchase_type?: PurchaseType;

  @IsOptional()
  @IsString()
  insurance_expiry?: string;

  @IsOptional()
  @IsString()
  inspection_date?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateVehicleStatusRequest {
  @IsEnum(['AVAILABLE', 'MAINTENANCE', 'DISPOSED'] as any)
  status: string;

  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class UpdateDedicatedRequest {
  @IsBoolean()
  is_dedicated: boolean;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  start_date?: string;

  @IsOptional()
  @IsString()
  end_date?: string;
}
