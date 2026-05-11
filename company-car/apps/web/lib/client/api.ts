'use client';

export class ClientApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

type FetchOpts = RequestInit & { silent?: boolean };

export async function apiFetch<T = unknown>(path: string, opts: FetchOpts = {}): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...opts.headers,
    },
    credentials: 'include',
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const code = json?.error?.code ?? `HTTP_${res.status}`;
    const message = json?.error?.message ?? res.statusText;
    throw new ClientApiError(res.status, code, message, json?.error?.details);
  }
  return json?.data as T;
}
