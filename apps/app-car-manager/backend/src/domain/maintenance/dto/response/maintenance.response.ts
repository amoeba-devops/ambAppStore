export class MaintenanceResponse {
  maintenanceId: string;
  vehicleId: string;
  type: string;
  description: string | null;
  shopName: string | null;
  cost: number | null;
  date: string;
  nextDate: string | null;
  performedBy: string | null;
  createdAt: string;
  vehiclePlateNumber?: string;
  vehicleModel?: string;
}
