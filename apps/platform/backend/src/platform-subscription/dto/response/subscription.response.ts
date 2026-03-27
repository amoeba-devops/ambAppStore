export class SubscriptionResponse {
  subId: string;
  entCode: string;
  entName: string;
  appSlug: string;
  appName: string;
  status: string;
  requestedBy: string;
  requestedEmail: string;
  reason: string;
  createdAt: string;
}

export class SubscriptionStatusResponse {
  appSlug: string;
  status: string | null;
  subId: string | null;
}
