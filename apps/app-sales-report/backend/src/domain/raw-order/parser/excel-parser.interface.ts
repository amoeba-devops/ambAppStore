/**
 * Common interface for channel-specific Excel parsers.
 */

export interface ParsedOrder {
  channelOrderId: string;
  packageId: string | null;
  orderDate: Date;
  status: string;
  statusRaw: string | null;
  cancelReason: string | null;
  trackingNo: string | null;
  carrier: string | null;
  deliveryMethod: string | null;
  orderType: string | null;
  estDeliveryDate: Date | null;
  shipDate: Date | null;
  deliveryTime: Date | null;
  totalWeightKg: number | null;
  totalVnd: number | null;
  shopVoucher: string | null;
  coinCashback: number | null;
  shopeeVoucher: string | null;
  promoCombo: string | null;
  shopeeComboDiscount: number | null;
  shopComboDiscount: number | null;
  shopeeCoinRebate: number | null;
  cardDiscount: number | null;
  tradeInDiscount: number | null;
  tradeInBonus: number | null;
  sellerTradeInBonus: number | null;
  shippingFeeEst: number | null;
  buyerShippingFee: number | null;
  shopeeShippingSubsidy: number | null;
  returnShippingFee: number | null;
  totalBuyerPayment: number | null;
  completedAt: Date | null;
  paidAt: Date | null;
  paymentMethod: string | null;
  commissionFee: number | null;
  serviceFee: number | null;
  paymentFee: number | null;
  deposit: number | null;
  province: string | null;
  district: string | null;
  country: string | null;
  items: ParsedOrderItem[];
}

export interface ParsedOrderItem {
  productSku: string | null;
  productName: string | null;
  variantSku: string | null;
  variantName: string | null;
  isBestseller: boolean;
  weightKg: number | null;
  originalPrice: number | null;
  sellerDiscount: number | null;
  platformDiscount: number | null;
  totalSellerSubsidy: number | null;
  dealPrice: number | null;
  quantity: number;
  returnQuantity: number;
  buyerPaid: number | null;
  returnStatus: string | null;
}

export interface ExcelParseResult {
  orders: ParsedOrder[];
  totalRows: number;
}

export interface ExcelParser {
  parse(buffer: Buffer): Promise<ExcelParseResult>;
}
