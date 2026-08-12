import 'server-only';
import { getTranslations } from 'next-intl/server';
import { resolveUiLocale } from '@/i18n/ui-locale';

/**
 * Download filename for an ad-hoc export, in the language the user is in when
 * they press the export button. The pattern lives in i18n next to the screen
 * that owns the button (`screens.truckFinance.fileName`, …) so each language
 * gets its own stem; `{y}` / `{mm}` are passed as strings because ICU would
 * digit-group a number ("2,026").
 *
 * Falls back to `fallback` if the key is missing, so a new export screen can
 * ship before its translations land.
 */
export async function exportFileName(
  namespace: string,
  key: string,
  values: Record<string, string>,
  fallback: string,
): Promise<string> {
  try {
    const t = await getTranslations({ locale: await resolveUiLocale(), namespace });
    /* Dynamic namespace + key — cast as in the other export routes. */
    const stem = (t as unknown as (k: string, v?: Record<string, string>) => string)(key, values);
    /* A missing message resolves to the key path ("screens.x.fileName") rather
     * than throwing — no pattern contains the key name, so that detects it. */
    return stem && !stem.includes(key) ? stem : fallback;
  } catch {
    return fallback;
  }
}

export { attachment } from './content-disposition';

/** Worksheet tab name (`exportContent.*.sheetName`) in the exporter's language — the
 * tab is as visible as the filename once the file is open. Excel caps tab names
 * at 31 chars and rejects `[]:*?/\`, so the result is trimmed and sanitised. */
export async function exportSheetName(namespace: string, fallback: string): Promise<string> {
  const raw = await exportFileName(namespace, 'sheetName', {}, fallback);
  return raw.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31).trim() || fallback;
}
