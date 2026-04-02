export class UploadResultResponse {
  channel: string;
  ordersCreated: number;
  ordersSkipped: number;
  itemsCreated: number;
  matchStats: {
    matched: number;
    unmatched: number;
    combo: number;
  };
  batchId: string;
}
