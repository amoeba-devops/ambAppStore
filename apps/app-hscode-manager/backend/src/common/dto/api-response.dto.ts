/**
 * 표준 API 응답 포맷 (CLAUDE.md API 규칙):
 *   { success, data, error?, timestamp }
 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  timestamp: string;
}

export interface ApiError {
  success: false;
  data: null;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export function ok<T>(data: T): ApiSuccess<T> {
  return { success: true, data, timestamp: new Date().toISOString() };
}

export function fail(code: string, message: string, details?: unknown): ApiError {
  return {
    success: false,
    data: null,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
    timestamp: new Date().toISOString(),
  };
}
