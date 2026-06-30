export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export interface ImportBatch {
  id: string;
  fileName: string;
  formatType: string;
  rowsTotal: number;
  rowsImported: number;
  rowsFailed: number;
  createdAt: string;
}

export interface ReviewItem {
  id: string;
  gtin: string | null;
  productInfo: Record<string, unknown> | null;
  candidates: Record<string, unknown>[] | null;
  status: string;
  assignedTo: string | null;
  createdAt: string;
}

export interface CountryExtension {
  hceId: string;
  hs6: string;
  country: string;
  hsFull: string;
  dutyRate: string | null;
  description: string | null;
}

export interface SettingView {
  key: string;
  value: string;
  isSecret: boolean;
}

export type SettingCategory = 'AI' | 'EXTERNAL' | 'EMBEDDING' | 'THRESHOLD';
