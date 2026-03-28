import { MaintenanceRecordEntity } from '../entity/maintenance-record.entity';
import { MaintenanceResponse } from '../dto/response/maintenance.response';

export class MaintenanceMapper {
  static toResponse(entity: MaintenanceRecordEntity): MaintenanceResponse {
    return {
      maintenanceId: entity.cmrId,
      vehicleId: entity.cvhId,
      type: entity.cmrType,
      description: entity.cmrDescription,
      shopName: entity.cmrShopName,
      cost: entity.cmrCost,
      date: entity.cmrDate instanceof Date ? entity.cmrDate.toISOString().slice(0, 10) : String(entity.cmrDate),
      nextDate: entity.cmrNextDate instanceof Date ? entity.cmrNextDate.toISOString().slice(0, 10) : entity.cmrNextDate ? String(entity.cmrNextDate) : null,
      performedBy: entity.cmrPerformedBy,
      createdAt: entity.cmrCreatedAt?.toISOString(),
      vehiclePlateNumber: entity.vehicle?.cvhPlateNumber,
      vehicleModel: entity.vehicle ? `${entity.vehicle.cvhMake} ${entity.vehicle.cvhModel}` : undefined,
    };
  }

  static toListResponse(entities: MaintenanceRecordEntity[]): MaintenanceResponse[] {
    return entities.map((e) => MaintenanceMapper.toResponse(e));
  }
}
