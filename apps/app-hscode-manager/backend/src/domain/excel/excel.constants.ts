export const EXCEL_QUEUE = 'excel-classify';

/** 고정 입력 템플릿 컬럼 (FR-031/035) */
export const TEMPLATE_COLUMNS = ['name', 'material', 'usage', 'processing', 'origin', 'unit'] as const;
export const REQUIRED_COLUMNS = ['name'] as const;
export const ALLOWED_UNITS = ['METRES', 'PIECES', 'SETS', 'ROLL'] as const;
