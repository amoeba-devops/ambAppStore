export class TripLogResponse {
  tripLogId: string;
  vehicleId: string;
  driverId: string;
  dispatchId: string;
  origin: string;
  destination: string;
  customerName: string | null;
  billNo: string | null;
  cdfNo: string | null;
  departActual: string | null;
  arriveActual: string | null;
  odoStart: number | null;
  odoEnd: number | null;
  distanceKm: number | null;
  refueled: boolean;
  fuelAmount: number | null;
  fuelCost: number | null;
  tollCost: number | null;
  hasAccident: boolean;
  note: string | null;
  krPurposeCode: string | null;
  krBusinessRatio: number | null;
  status: string;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // 조인 정보
  vehiclePlateNumber?: string;
  vehicleModel?: string;
}
