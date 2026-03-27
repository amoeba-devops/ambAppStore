export interface BaseResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
  timestamp: string;
}

export interface BaseListResponse<T> extends BaseResponse<T[]> {}
export interface BaseSingleResponse<T> extends BaseResponse<T> {}

export function successResponse<T>(data: T): BaseResponse<T> {
  return {
    success: true,
    data,
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
