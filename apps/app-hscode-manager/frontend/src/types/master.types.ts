export type SupportStatus = 'ACTIVE' | 'BETA' | 'NOT_SUPPORTED';

export interface ImportCountry {
  id: string;
  code: string;
  nameKo: string;
  nameEn: string;
  nameVi: string;
  supportStatus: SupportStatus;
  adapterKey: string | null;
  currencyCode: string | null;
  defaultTariffCurrency: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExportCountry {
  id: string;
  code: string;
  nameKo: string;
  nameEn: string;
  nameVi: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Exporter {
  id: string;
  name: string;
  countryCode: string;
  aliases: string[];
  riskFlags: Record<string, unknown> | null;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalDataSource {
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

export interface FtaMatrixRow {
  id: string;
  importCountryCode: string;
  exportCountryCode: string;
  agreementCode: string;
  hsCode: string;
  rate: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MeProfile {
  userId: string;
  entityId: string;
  entityCode: string;
  email: string;
  name: string;
  roles: string[];
}
