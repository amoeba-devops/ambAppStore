export class FtaMatrixResponse {
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
