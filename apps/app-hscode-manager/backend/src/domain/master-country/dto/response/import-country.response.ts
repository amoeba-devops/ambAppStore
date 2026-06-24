import { ImportCountrySupportStatus } from '../../entity/import-country.entity';

export class ImportCountryResponse {
  id: string;
  code: string;
  nameKo: string;
  nameEn: string;
  nameVi: string;
  supportStatus: ImportCountrySupportStatus;
  adapterKey: string | null;
  currencyCode: string | null;
  defaultTariffCurrency: string | null;
  createdAt: string;
  updatedAt: string;
}
