export interface RowValidationError {
  row: number;
  col: string;
  reason: string;
}

export interface ExcelValidationResult {
  validRows: unknown[];
  errors: RowValidationError[];
}

export interface ClassifyEnqueueResult {
  jobId: string;
  total: number;
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

export interface JobStatus {
  jobId: string;
  status: string;
  progress: number;
  total: number | null;
  results: RowResult[] | null;
}

export interface AttributePayload {
  name: string;
  material?: string;
  usage?: string;
  processing?: string;
  origin?: string;
  unit?: string;
}
