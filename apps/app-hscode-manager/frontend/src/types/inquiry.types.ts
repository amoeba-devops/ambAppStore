export type InquiryStatus =
  | 'DRAFT'
  | 'INTAKE'
  | 'MATCHING'
  | 'REVIEWING'
  | 'RESPONDED'
  | 'VERIFIED'
  | 'DISPUTED';

export interface Inquiry {
  id: string;
  exporterId: string | null;
  exportCountryCode: string | null;
  importCountryCode: string | null;
  title: string | null;
  memo: string | null;
  status: InquiryStatus;
  completenessScore: number | null;
  submittedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  warnings?: string[];
}

export type ItemCategory =
  | 'CHEMICAL'
  | 'STEEL_MECHANICAL'
  | 'EQUIPMENT'
  | 'OTHER';

export interface Item {
  id: string;
  inquiryId: string | null;
  nameRaw: string;
  nameNormalized: string | null;
  category: ItemCategory;
  usageDescription: string | null;
  compositionHash: string | null;
  specAttributes: Record<string, unknown> | null;
  gtin: string | null;
  completenessScore: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface FieldSpec {
  key: string;
  label_ko: string;
  label_en: string;
  label_vi: string;
  type: 'string' | 'number' | 'enum' | 'array' | 'object' | 'file_ref';
  required: boolean;
  enum_values?: string[];
  hint?: string;
  unit?: string;
}

export interface CategorySchema {
  category: ItemCategory;
  common_fields: FieldSpec[];
  required_fields: FieldSpec[];
  optional_fields: FieldSpec[];
  auto_escalate?: boolean;
}

export interface ExcelPreview {
  sheets: string[];
  sheet: string;
  headerRow: number;
  headers: string[];
  previewRows: Array<Record<string, unknown>>;
  totalRows: number;
  suggestedMapping: Record<string, string | null>;
}

export interface ExcelImportResult {
  batchId: string;
  totalRows: number;
  importedRows: number;
  holdRows: number;
}

export interface ExcelBatch {
  id: string;
  inquiryId: string;
  filename: string;
  totalRows: number;
  importedRows: number;
  holdRows: number;
  status: 'PENDING' | 'IMPORTED' | 'PARTIAL' | 'FAILED';
  mappingSnapshot: unknown;
  createdAt: string;
}

export interface HoldRow {
  id: string;
  rowIndex: number;
  rawData: Record<string, unknown>;
  validationErrors: Array<{ field: string; code: string; message: string }> | null;
  resolvedAt: string | null;
}
