export class ExternalDataSourceResponse {
  id: string;
  adapterKey: string;
  importCountryCode: string;
  displayName: string;
  endpointUrl: string | null;
  cacheTtlSec: number;
  isActive: boolean;
  priority: number;
  config: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}
