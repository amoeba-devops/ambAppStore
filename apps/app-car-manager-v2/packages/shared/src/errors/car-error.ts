/**
 * App error type. Code format: `CAR-E{4 digits}`. See CLAUDE.md §4.4.
 */
export class CarError extends Error {
  constructor(
    public readonly code: string,
    public readonly httpStatus: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'CarError';
  }
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };
