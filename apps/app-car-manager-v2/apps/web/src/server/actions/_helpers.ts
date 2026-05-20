import 'server-only';
import { CarError } from '@car-v2/shared/errors';
import type { ActionResult } from '@car-v2/shared/errors';

/**
 * Wrap a Server Action body so all thrown errors are flattened to the standard
 * ActionResult<T> shape.
 *
 * Display policy:
 *   - 4xx CarError      → propagate code + message (caller knows what to do)
 *   - Zod parse fail    → CAR-E0001 + the validator's message (still client-friendly)
 *   - 5xx CarError      → mask message to generic "Internal server error"
 *   - Unexpected throw  → CAR-E0500 + generic message
 *
 * Server log always carries the FULL detail (stack + cause + Postgres error code)
 * so backend can diagnose, while the UI gets a safe message.
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (err) {
    if (err instanceof CarError) {
      if (err.httpStatus >= 500) {
        logInternalError('CarError', err.code, err);
        return {
          success: false,
          error: { code: err.code, message: 'Internal server error' },
        };
      }
      /* 4xx client error — message is safe + informative. */
      return { success: false, error: { code: err.code, message: err.message } };
    }

    if (err instanceof Error) {
      if (err.name === 'ZodError') {
        return { success: false, error: { code: 'CAR-E0001', message: err.message } };
      }
      logInternalError('Unexpected', 'CAR-E0500', err);
      return {
        success: false,
        error: { code: 'CAR-E0500', message: 'Internal server error' },
      };
    }

    logInternalError('Unknown', 'CAR-E0500', err);
    return { success: false, error: { code: 'CAR-E0500', message: 'Internal server error' } };
  }
}

/**
 * Verbose backend log for 5xx — caller never sees this, only operators do.
 * Includes Postgres `code` when present (vd `23505` = unique_violation) and the
 * full stack so traces survive Next.js's Server Action serialization layer.
 */
function logInternalError(kind: string, errorCode: string, err: unknown): void {
  const ts = new Date().toISOString();
  const headline = `[action] ${kind} ${errorCode} at ${ts}`;
  if (err instanceof Error) {
    /* Postgres errors from `pg`/`@neondatabase/serverless` attach `code`, `detail`,
     * `table`, `constraint` — expose them for debuggability. */
    const pg = err as Error & {
      code?: string;
      detail?: string;
      table?: string;
      constraint?: string;
      cause?: unknown;
    };
    /* eslint-disable no-console */
    console.error(headline, {
      message: err.message,
      name: err.name,
      pgCode: pg.code,
      pgDetail: pg.detail,
      pgTable: pg.table,
      pgConstraint: pg.constraint,
    });
    if (err.stack) console.error(err.stack);
    if (pg.cause) console.error('caused by:', pg.cause);
    /* eslint-enable no-console */
  } else {
    /* eslint-disable-next-line no-console */
    console.error(headline, err);
  }
}
