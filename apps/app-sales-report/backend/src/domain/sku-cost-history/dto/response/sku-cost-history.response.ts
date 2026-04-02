export class SkuCostHistoryResponse {
  schId: string;
  skuId: string;
  primeCost: number;
  supplyPrice: number;
  listingPrice: number;
  sellingPrice: number;
  effectiveDate: string;
  memo: string | null;
  createdBy: string | null;
  createdAt: string;
}
