import { VehicleDriverEntity } from '../entity/vehicle-driver.entity';
import { DriverResponse } from '../dto/response/driver.response';

export class DriverMapper {
  static toResponse(entity: VehicleDriverEntity): DriverResponse {
    return {
      driverId: entity.cvdId,
      vehicleId: entity.cvhId,
      amaUserId: entity.cvdAmaUserId,
      driverName: entity.cvdDriverName,
      driverEmail: entity.cvdDriverEmail,
      role: entity.cvdRole,
      status: entity.cvdStatus,
      leaveStart: entity.cvdLeaveStart?.toISOString().slice(0, 10) ?? null,
      leaveEnd: entity.cvdLeaveEnd?.toISOString().slice(0, 10) ?? null,
      note: entity.cvdNote,
      createdAt: entity.cvdCreatedAt?.toISOString(),
      updatedAt: entity.cvdUpdatedAt?.toISOString(),
      vehiclePlateNumber: entity.vehicle?.cvhPlateNumber,
      vehicleModel: entity.vehicle ? `${entity.vehicle.cvhMake} ${entity.vehicle.cvhModel}` : undefined,
    };
  }

  static toListResponse(entities: VehicleDriverEntity[]): DriverResponse[] {
    return entities.map((e) => DriverMapper.toResponse(e));
  }
}
