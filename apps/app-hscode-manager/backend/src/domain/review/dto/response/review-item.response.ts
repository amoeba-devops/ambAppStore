export class ReviewItemResponse {
  id: string;
  gtin: string | null;
  productInfo: Record<string, unknown> | null;
  candidates: Record<string, unknown>[] | null;
  status: string;
  assignedTo: string | null;
  createdAt: string;
}
