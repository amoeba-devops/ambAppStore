export interface ExcelRow {
  rowNo: number;
  name: string;
  material?: string;
  usage?: string;
  processing?: string;
  origin?: string;
  unit?: string;
}

export interface RowValidationError {
  row: number;
  col: string;
  reason: string;
}

export interface ExcelValidationResult {
  validRows: ExcelRow[];
  errors: RowValidationError[];
}

export type RowStatus = 'AUTO' | 'REVIEW' | 'ERROR';

export interface RowResult {
  rowNo: number;
  name: string;
  hsCode: string;
  hs6: string;
  confidence: number;
  status: RowStatus;
}

export interface ClassifyJobData {
  entId: string;
  rows: ExcelRow[];
}

export interface ClassifyJobResult {
  results: RowResult[];
  total: number;
}
