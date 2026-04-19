import { TripLogEntity } from '../entity/trip-log.entity';
import { TripLogResponse } from '../dto/response/trip-log.response';

export class TripLogMapper {
  static toResponse(entity: TripLogEntity): TripLogResponse {
    return {
      tripLogId: entity.ctlId,
      vehicleId: entity.cvhId,
      driverId: entity.cvdId,
      dispatchId: entity.cdrId,
      origin: entity.ctlOrigin,
      destination: entity.ctlDestination,
      customerName: entity.ctlCustomerName ?? null,
      billNo: entity.ctlBillNo ?? null,
      cdfNo: entity.ctlCdfNo ?? null,
      departActual: entity.ctlDepartActual?.toISOString() ?? null,
      arriveActual: entity.ctlArriveActual?.toISOString() ?? null,
      odoStart: entity.ctlOdoStart,
      odoEnd: entity.ctlOdoEnd,
      distanceKm: entity.ctlDistanceKm ? Number(entity.ctlDistanceKm) : null,
      refueled: entity.ctlRefueled,
      fuelAmount: entity.ctlFuelAmount ? Number(entity.ctlFuelAmount) : null,
      fuelCost: entity.ctlFuelCost,
      tollCost: entity.ctlTollCost,
      hasAccident: entity.ctlHasAccident,
      note: entity.ctlNote,
      krPurposeCode: entity.ctlKrPurposeCode,
      krBusinessRatio: entity.ctlKrBusinessRatio,
      status: entity.ctlStatus,
      submittedAt: entity.ctlSubmittedAt?.toISOString() ?? null,
      createdAt: entity.ctlCreatedAt?.toISOString(),
      updatedAt: entity.ctlUpdatedAt?.toISOString(),
      vehiclePlateNumber: entity.vehicle?.cvhPlateNumber,
      vehicleModel: entity.vehicle ? `${entity.vehicle.cvhMake} ${entity.vehicle.cvhModel}` : undefined,
      driverName: entity.driver?.cvdDriverName ?? null,
      passengerCount: entity.dispatchRequest?.cdrPassengerCount ?? null,
    };
  }

  static toListResponse(entities: TripLogEntity[]): TripLogResponse[] {
    return entities.map((e) => TripLogMapper.toResponse(e));
  }
}
