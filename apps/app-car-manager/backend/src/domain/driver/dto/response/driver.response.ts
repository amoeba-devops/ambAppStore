export class DriverResponse {
  driverId: string;
  vehicleId: string | null;
  amaUserId: string;
  driverName: string | null;
  driverEmail: string | null;
  role: string;
  status: string;
  leaveStart: string | null;
  leaveEnd: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  // 차량 정보 (조인 시)
  vehiclePlateNumber?: string;
  vehicleModel?: string;
}
