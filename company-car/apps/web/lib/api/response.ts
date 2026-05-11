import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';

type ApiErrorBody = {
  code: string;
  message: string;
  details?: unknown;
};

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, init);
}

export function paginated<T>(
  data: T,
  meta: { page: number; limit: number; total: number },
  init?: ResponseInit,
): NextResponse {
  return NextResponse.json(
    {
      data,
      meta: {
        ...meta,
        totalPages: meta.limit ? Math.ceil(meta.total / meta.limit) : 0,
      },
    },
    init,
  );
}

export function fail(status: number, code: string, message: string, details?: unknown): NextResponse {
  const body: { error: ApiErrorBody } = { error: { code, message } };
  if (details !== undefined) body.error.details = details;
  return NextResponse.json(body, { status });
}

export function unauthorized(message = 'Unauthorized') {
  return fail(401, 'UNAUTHORIZED', message);
}

export function forbidden(message = 'Forbidden') {
  return fail(403, 'FORBIDDEN', message);
}

export function notFound(message = 'Not found') {
  return fail(404, 'NOT_FOUND', message);
}

export function badRequest(message: string, details?: unknown) {
  return fail(400, 'INVALID_INPUT', message, details);
}

export function conflict(message: string, details?: unknown) {
  return fail(409, 'CONFLICT', message, details);
}

export function fromZod(err: ZodError) {
  return badRequest('Invalid input', err.flatten());
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function handleError(err: unknown): NextResponse {
  if (err instanceof HttpError) {
    return fail(err.status, err.code, err.message, err.details);
  }
  console.error('[unhandled]', err);
  return fail(500, 'INTERNAL_ERROR', 'Internal server error');
}
