import { DispatchRequestEntity } from '../entity/dispatch-request.entity';
import { DispatchResponse, DispatchDetailResponse } from '../dto/response/dispatch.response';

export class DispatchMapper {
  static toResponse(entity: DispatchRequestEntity): DispatchResponse {
    return {
      dispatchId: entity.cdrId,
      vehicleId: entity.cvhId,
      driverId: entity.cvdId,
      requesterId: entity.cdrRequesterId,
      requesterName: entity.cdrRequesterName,
      purposeType: entity.cdrPurposeType,
      purpose: entity.cdrPurpose,
      departAt: entity.cdrDepartAt?.toISOString(),
      returnAt: entity.cdrReturnAt?.toISOString(),
      origin: entity.cdrOrigin,
      destination: entity.cdrDestination,
      passengerCount: entity.cdrPassengerCount,
      status: entity.cdrStatus,
      createdAt: entity.cdrCreatedAt?.toISOString(),
      vehiclePlateNumber: entity.vehicle?.cvhPlateNumber,
      vehicleModel: entity.vehicle ? `${entity.vehicle.cvhMake} ${entity.vehicle.cvhModel}` : undefined,
      driverName: entity.driver?.cvdDriverName || undefined,
    };
  }

  static toDetailResponse(entity: DispatchRequestEntity): DispatchDetailResponse {
    return {
      ...DispatchMapper.toResponse(entity),
      passengerList: entity.cdrPassengerList,
      preferredVehicleType: entity.cdrPreferredVehicleType,
      cargoInfo: entity.cdrCargoInfo,
      isProxy: entity.cdrIsProxy,
      actualUserName: entity.cdrActualUserName,
      externalGuest: entity.cdrExternalGuest,
      note: entity.cdrNote,
      rejectReason: entity.cdrRejectReason,
      driverRejectReason: entity.cdrDriverRejectReason,
      cancelReason: entity.cdrCancelReason,
      driverOverride: entity.cdrDriverOverride,
      approvedAt: entity.cdrApprovedAt?.toISOString() ?? null,
      driverAcceptedAt: entity.cdrDriverAcceptedAt?.toISOString() ?? null,
      departedAt: entity.cdrDepartedAt?.toISOString() ?? null,
      arrivedAt: entity.cdrArrivedAt?.toISOString() ?? null,
      completedAt: entity.cdrCompletedAt?.toISOString() ?? null,
    };
  }

  static toListResponse(entities: DispatchRequestEntity[]): DispatchResponse[] {
    return entities.map((e) => DispatchMapper.toResponse(e));
  }
}
