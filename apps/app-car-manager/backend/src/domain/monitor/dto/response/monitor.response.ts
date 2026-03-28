export class DashboardSummaryResponse {
  vehicles: {
    total: number;
    available: number;
    inUse: number;
    maintenance: number;
    unavailable: number;
  };
  drivers: {
    total: number;
    active: number;
    onLeave: number;
    inactive: number;
  };
  dispatches: {
    pending: number;
    approved: number;
    inProgress: number;
    completedToday: number;
  };
}

export class ActiveDispatchResponse {
  dispatchId: string;
  vehiclePlateNumber: string;
  vehicleModel: string;
  driverName: string | null;
  origin: string;
  destination: string;
  status: string;
  departAt: string;
  returnAt: string;
}
