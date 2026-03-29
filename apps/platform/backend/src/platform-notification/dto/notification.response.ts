export class NotificationResponse {
  ntfId: string;
  type: string;
  title: string;
  message: string;
  refType: string | null;
  refId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export class NotificationListResponse {
  items: NotificationResponse[];
  pagination: {
    page: number;
    size: number;
    totalCount: number;
    totalPages: number;
  };
}

export class UnreadCountResponse {
  count: number;
}
