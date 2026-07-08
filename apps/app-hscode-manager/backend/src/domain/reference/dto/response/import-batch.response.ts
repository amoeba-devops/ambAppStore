export class ImportBatchResponse {
  id: string;
  fileName: string;
  formatType: string;
  rowsTotal: number;
  rowsImported: number;
  rowsFailed: number;
  createdAt: string;
}
