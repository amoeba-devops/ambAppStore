export interface BaseResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
  timestamp: string;
}

export interface PaginationMeta {
  page: number;
  size: number;
  totalCount: number;
  totalPages: number;
}

export interface BaseListResponse<T> extends BaseResponse<T[]> {
  pagination?: PaginationMeta;
}

export interface BaseSingleResponse<T> extends BaseResponse<T> {}

export function successResponse<T>(data: T): BaseSingleResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

export function successListResponse<T>(
  data: T[],
  pagination?: PaginationMeta,
): BaseListResponse<T> {
  return {
    success: true,
    data,
    pagination,
    timestamp: new Date().toISOString(),
  };
}

export function errorResponse(code: string, message: string): BaseResponse<null> {
  return {
    success: false,
    data: null,
    error: { code, message },
    timestamp: new Date().toISOString(),
  };
}
