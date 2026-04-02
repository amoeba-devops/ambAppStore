export class ChannelMasterResponse {
  chnCode: string;
  name: string;
  type: string;
  defaultPlatformFeeRate: number | null;
  defaultFulfillmentFee: number | null;
  isApiIntegrated: boolean;
  isActive: boolean;
}
