export interface ApiSuccess<T> {
  success: true;
  data: T;
  timestamp: string;
}

export interface ApiErrorBody {
  success: false;
  data: null;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiErrorBody;

/**
 * Axios response.data 가 표준 envelope 일 때 data 필드만 추출.
 * 에러 envelope 이면 throw 한다 (axios interceptor 에서 잡히지 않은 200 응답에 한해 일관성 보장).
 */
export function unwrap<T>(env: ApiEnvelope<T>): T {
  if (env.success) return env.data;
  throw new Error(`[${env.error.code}] ${env.error.message}`);
}
