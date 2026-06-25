/**
 * Format Server Action error for display in toast/dialog.
 *
 * Rules:
 *   - CAR-E05xx → internal server error (i18n localized, hide raw message)
 *   - CAR-E0001 → Zod-parse failures arrive as raw JSON in the message
 *     field (`runAction` doesn't pretty-print). Detect that and render a
 *     readable bullet list per failing field instead of a wall of JSON.
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

interface ZodIssue {
  code: string;
  path: (string | number)[];
  message: string;
}

/**
 * Try to parse the message as a Zod issue array and produce a human-friendly
 * summary. Returns `null` if the message isn't recognisable Zod JSON.
 */
function formatZodIssues(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed.startsWith('[')) return null;
  try {
    const issues = JSON.parse(trimmed) as ZodIssue[];
    if (!Array.isArray(issues) || issues.length === 0) return null;
    /* One bullet per failing field. Each issue already carries a localised-
     * enough English message ("Number must be greater than or equal to 5"),
     * good enough for an inline toast — the field name from `path` is the
     * key information the user needs to act on. */
    return issues
      .map((it) => {
        const field = it.path.length > 0 ? it.path.join('.') : '?';
        return `• ${field}: ${it.message}`;
      })
      .join('\n');
  } catch {
    return null;
  }
}

export function formatActionError(
  error: ActionErrorLike,
  t: (key: string) => string,
): string {
  if (error.code.startsWith('CAR-E05')) {
    return `${error.code} — ${t('errors.internal')}`;
  }
  if (error.code === 'CAR-E0001') {
    const friendly = formatZodIssues(error.message);
    if (friendly) return friendly;
  }
  return `${error.code} — ${error.message}`;
}
