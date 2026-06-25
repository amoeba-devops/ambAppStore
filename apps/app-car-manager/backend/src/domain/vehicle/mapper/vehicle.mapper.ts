import { VehicleEntity } from '../entity/vehicle.entity';
import { VehicleResponse, VehicleDetailResponse } from '../dto/response/vehicle.response';
import { toDateString } from '../../../common/utils/date.util';

export class VehicleMapper {
  static toResponse(entity: VehicleEntity): VehicleResponse {
    return {
      cvhId: entity.cvhId,
      plateNumber: entity.cvhPlateNumber,
      type: entity.cvhType,
      make: entity.cvhMake,
      model: entity.cvhModel,
      year: entity.cvhYear,
      color: entity.cvhColor,
      fuelType: entity.cvhFuelType,
      transmission: entity.cvhTransmission,
      maxPassengers: entity.cvhMaxPassengers,
      maxLoadTon: entity.cvhMaxLoadTon ? Number(entity.cvhMaxLoadTon) : null,
      cargoType: entity.cvhCargoType,
      status: entity.cvhStatus,
      isDedicated: entity.cvhIsDedicated,
      dedicatedDept: entity.cvhDedicatedDept,
      dedicatedStart: toDateString(entity.cvhDedicatedStart),
      dedicatedEnd: toDateString(entity.cvhDedicatedEnd),
      insuranceExpiry: toDateString(entity.cvhInsuranceExpiry),
      inspectionDate: toDateString(entity.cvhInspectionDate),
      note: entity.cvhNote,
      createdAt: entity.cvhCreatedAt.toISOString(),
    };
  }

  static toDetailResponse(entity: VehicleEntity): VehicleDetailResponse {
    return {
      ...VehicleMapper.toResponse(entity),
      amaAssetId: entity.cvhAmaAssetId,
      vin: entity.cvhVin,
      displacement: entity.cvhDisplacement,
      purchaseType: entity.cvhPurchaseType,
      purchaseDate: toDateString(entity.cvhPurchaseDate),
      purchasePrice: entity.cvhPurchasePrice ? Number(entity.cvhPurchasePrice) : null,
      statusReason: entity.cvhStatusReason,
    };
  }

  static toListResponse(entities: VehicleEntity[]): VehicleResponse[] {
    return entities.map(VehicleMapper.toResponse);
  }
}
