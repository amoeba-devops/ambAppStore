import 'server-only';
import { CarError } from '@car-v2/shared/errors';
import type { ActionResult } from '@car-v2/shared/errors';

/**
 * Wrap a Server Action body so all thrown errors are flattened to the standard
 * ActionResult<T> shape. Internal errors are masked with a generic message;
 * known CarErrors propagate their code + message.
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (err) {
    if (err instanceof CarError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    if (err instanceof Error) {
      // Zod errors arrive here too — surface a readable code.
      const code = err.name === 'ZodError' ? 'CAR-E0001' : 'CAR-E0500';
      /* eslint-disable-next-line no-console */
      console.error('[action] unexpected error:', err);
      return { success: false, error: { code, message: err.message } };
    }
    return { success: false, error: { code: 'CAR-E0500', message: 'Unknown error' } };
  }
}
