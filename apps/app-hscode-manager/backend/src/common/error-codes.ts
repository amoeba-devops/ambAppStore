/**
 * HS Code Manager 에러 코드 체계 — prefix `HSC-E{4자리}` (CLAUDE.md).
 * 백엔드 메시지는 영어 고정, 프론트는 코드 기반 i18n 번역.
 */
export const ERROR_CODES = {
  // 공통 (E9xxx)
  UNKNOWN: 'HSC-E9999',
  VALIDATION: 'HSC-E9001',

  // 인증/권한 (E1xxx)
  UNAUTHORIZED: 'HSC-E1001',
  FORBIDDEN_ROLE: 'HSC-E1002',
  ENTITY_SCOPE_MISSING: 'HSC-E1003',

  // 검색/분류 (E2xxx)
  EMPTY_QUERY: 'HSC-E2001',
  SEARCH_INDEX_UNAVAILABLE: 'HSC-E2002',
  NO_CANDIDATE: 'HSC-E2003',

  // 바코드/GTIN (E3xxx)
  INVALID_GTIN: 'HSC-E3001',
  COUNTRY_REQUIRED: 'HSC-E3002',
  COUNTRY_EXTENSION_MISSING: 'HSC-E3003',

  // 엑셀/배치 (E4xxx)
  INVALID_TEMPLATE: 'HSC-E4001',
  BATCH_TOO_LARGE: 'HSC-E4002',

  // 참조/Import (E5xxx)
  UNSUPPORTED_FORMAT: 'HSC-E5001',
  IMPORT_FAILED: 'HSC-E5002',

  // 설정 (E6xxx)
  SETTING_NOT_FOUND: 'HSC-E6001',
  EXTERNAL_CONNECTION_FAILED: 'HSC-E6002',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
