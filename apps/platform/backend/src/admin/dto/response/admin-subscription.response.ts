export class AdminSubscriptionResponse {
  subId: string;
  entId: string;
  entCode: string;
  entName: string;
  appId: string;
  appSlug: string;
  appName: string;
  status: string;
  requestedBy: string;
  requestedName: string;
  requestedEmail: string;
  reason: string | null;
  rejectReason: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export class AdminSubscriptionListResponse {
  items: AdminSubscriptionResponse[];
  pagination: {
    page: number;
    size: number;
    totalCount: number;
    totalPages: number;
  };
}

export class AdminSubscriptionStatsResponse {
  total: number;
  pending: number;
  active: number;
  suspended: number;
  rejected: number;
  cancelled: number;
  byApp: Array<{
    appSlug: string;
    appName: string;
    active: number;
    pending: number;
    total: number;
  }>;
}
