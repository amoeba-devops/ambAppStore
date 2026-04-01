export class EntityAppSubscription {
  appSlug: string;
  appName: string | null;
  appNameEn: string;
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
