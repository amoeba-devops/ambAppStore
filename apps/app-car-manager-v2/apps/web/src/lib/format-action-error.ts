/**
 * Format Server Action error for display in toast/dialog.
 *
 * Rules:
 *   - CAR-E05xx → internal server error (i18n localized, hide raw message)
 *   - CAR-E0001 → use returned message as-is (validation feedback for user)
 *   - Other 4xx → use returned message as-is (informative)
 *
 * Why mask only 5xx: 4xx messages are written by us and meant for users
 * (e.g. "Trip already confirmed"), while 5xx leaks DB constraint names,
 * SQL hints, or stack-derived strings the user can't act on.
 */
export interface ActionErrorLike {
  code: string;
  message: string;
}

export function formatActionError(
  error: ActionErrorLike,
  t: (key: string) => string,
): string {
  if (error.code.startsWith('CAR-E05')) {
    return `${error.code} — ${t('errors.internal')}`;
  }
  return `${error.code} — ${error.message}`;
}
