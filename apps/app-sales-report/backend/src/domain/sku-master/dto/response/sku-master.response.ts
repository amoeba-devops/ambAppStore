export class SkuMasterResponse {
  skuId: string;
  spuId: string;
  spuCode: string;
  wmsCode: string;
  nameKr: string;
  nameEn: string;
  nameVi: string;
  variantType: string | null;
  variantValue: string | null;
  syncCode: string | null;
  gtinCode: string | null;
  hsCode: string | null;
  description: string | null;
  color: string | null;
  primeCost: number;
  supplyPrice: number | null;
  listingPrice: number | null;
  sellingPrice: number | null;
  fulfillmentFeeOverride: number | null;
  weightGram: number | null;
  unit: string | null;
  isActive: boolean;
  costUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
