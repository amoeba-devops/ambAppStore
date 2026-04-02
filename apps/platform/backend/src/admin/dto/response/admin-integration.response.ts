export interface AdminIntegrationResponse {
  peiId: string;
  entId: string;
  category: string;
  serviceCode: string;
  serviceName: string;
  endpoint: string | null;
  keyName: string | null;
  hasKeyValue: boolean;
  extraConfig: Record<string, unknown> | null;
  isActive: boolean;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
