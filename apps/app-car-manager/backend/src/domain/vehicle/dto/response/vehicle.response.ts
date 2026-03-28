export class VehicleResponse {
  cvhId: string;
  plateNumber: string;
  type: string;
  make: string;
  model: string;
  year: number;
  color: string | null;
  fuelType: string;
  transmission: string | null;
  maxPassengers: number;
  maxLoadTon: number | null;
  cargoType: string | null;
  status: string;
  isDedicated: boolean;
  dedicatedDept: string | null;
  dedicatedStart: string | null;
  dedicatedEnd: string | null;
  insuranceExpiry: string | null;
  inspectionDate: string | null;
  note: string | null;
  createdAt: string;
}

export class VehicleDetailResponse extends VehicleResponse {
  amaAssetId: string | null;
  vin: string | null;
  displacement: number | null;
  purchaseType: string | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  statusReason: string | null;
}
