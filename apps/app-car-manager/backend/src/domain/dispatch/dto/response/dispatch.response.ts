export class DispatchResponse {
  dispatchId: string;
  vehicleId: string | null;
  driverId: string | null;
  requesterId: string;
  requesterName: string;
  purposeType: string;
  purpose: string;
  departAt: string;
  returnAt: string;
  origin: string;
  destination: string;
  passengerCount: number;
  status: string;
  createdAt: string;
  // 조인 정보
  vehiclePlateNumber?: string;
  vehicleModel?: string;
  driverName?: string;
}

export class DispatchDetailResponse extends DispatchResponse {
  passengerList: string[] | null;
  preferredVehicleType: string | null;
  cargoInfo: string | null;
  isProxy: boolean;
  actualUserName: string | null;
  externalGuest: Record<string, unknown> | null;
  note: string | null;
  rejectReason: string | null;
  driverRejectReason: string | null;
  cancelReason: string | null;
  driverOverride: boolean;
  approvedAt: string | null;
  driverAcceptedAt: string | null;
  departedAt: string | null;
  arrivedAt: string | null;
  completedAt: string | null;
}
