export class EntityAppSubscription {
  appSlug: string;
  appName: string;
  appNameEn: string | null;
  appStatus: string;
  appIconUrl: string | null;
  subscription: {
    subId: string;
    status: string;
    requestedAt: string;
    approvedAt: string | null;
    expiresAt: string | null;
  } | null;
}

export class EntitySubscriptionResponse {
  entId: string;
  apps: EntityAppSubscription[];
}
