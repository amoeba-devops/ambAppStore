/**
 * Typing / pasting decimal amounts in vi-VN style (FIX-261126 OBS-1) — used by
 * `MoneyInput` when `decimals > 0` (truck fuel unit price đ/L and litres).
 *
 * Field text follows vi-VN: "." groups thousands, "," marks the decimals —
 * "21.350,5". The RAW form-state string is what `Number()` understands: digits,
 * optionally "." + at most `decimals` digits ("21350", "21350.", "21350.5").
 * A trailing "." / trailing zeros are kept in RAW on purpose: they are what the
 * user is in the middle of typing ("21.350," → "21.350,0" → "21.350,05").
 *
 * Before this, the price field ran through `digitsOnly`, which dropped both
 * separators: a fractional price could not be entered, and touching an
 * imported 21.350,5 turned it into 2.135.050 (×100).
 */

/** "21350" → "21.350". */
function groupThousands(int: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Raw form value → field text ("21350.5" → "21.350,5"). Anything not shaped
 * like a raw decimal (or empty) passes through untouched. */
export function formatDecimalRaw(raw: string): string {
  const m = /^(\d*)(?:\.(\d*))?$/.exec(raw);
  if (!m || raw === '') return raw;
  const int = (m[1] ?? '').replace(/^0+(?=\d)/, '');
  const intOut = int === '' ? '0' : groupThousands(int);
  return m[2] === undefined ? intOut : `${intOut},${m[2]}`;
}

/** A stored value ("21350.50", "30.00") → raw without padding zeros
 * ("21350.5", "30"), so an edit form doesn't open on "21.350,50". */
export function canonicalDecimalRaw(stored: string | number | null | undefined): string {
  if (stored == null || stored === '') return '';
  const n = Number(stored);
  return Number.isFinite(n) && n >= 0 ? String(n) : String(stored);
}

/** Text that follows the field's own convention ("." thousands, "," decimal)
 * → canonical digits with "." as the decimal mark. */
function displayToCanon(text: string): string {
  return text.replace(/[^\d,]/g, '').replace(/,/g, '.');
}

/**
 * Freshly inserted text → canonical. One key: a digit, or "." / "," = the
 * decimal mark (whichever key the keyboard has). A longer chunk (paste,
 * autofill, IME commit) may be written either way, so it is read by shape:
 *  - both "." and "," present → the LAST kind is the decimal mark ("1.234,5", "1,234.5");
 *  - one kind only → thousands when it is laid out as thousands (1–3 digits,
 *    then groups of exactly 3: "21.350", "1.234.567") — a decimal part is never
 *    3 digits long here — otherwise its last occurrence is the decimal mark
 *    ("21350.5", "21350,5", "21350.555").
 */
function chunkToCanon(chunk: string): string {
  const s = chunk.replace(/[^\d.,]/g, '');
  if (s.length <= 1) return s === ',' ? '.' : s;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    const mark = lastDot > lastComma ? lastDot : lastComma;
    return s.slice(0, mark).replace(/[.,]/g, '') + '.' + s.slice(mark + 1).replace(/[.,]/g, '');
  }
  if (lastDot < 0 && lastComma < 0) return s;
  const sep = lastDot >= 0 ? '.' : ',';
  const groups = s.split(sep);
  const head = groups[0] ?? '';
  const thousands =
    groups.length > 1 && head.length >= 1 && head.length <= 3 && groups.slice(1).every((g) => g.length === 3);
  if (thousands) return groups.join('');
  const mark = s.lastIndexOf(sep);
  return s.slice(0, mark).split(sep).join('') + '.' + s.slice(mark + 1);
}

/**
 * New field text → raw, knowing the text the field showed just before
 * (`prevText`). Diffing the two tells what was actually typed or pasted, which
 * is the only way to read a "." correctly: in the displayed text a "." is a
 * thousands separator (deleting a digit from "21.350" leaves "21.35", which
 * means 2135, not 21,35), but a "." the user just typed is the decimal mark.
 */
export function parseDecimalText(text: string, prevText: string, decimals: number): string {
  let p = 0;
  const max = Math.min(text.length, prevText.length);
  while (p < max && text[p] === prevText[p]) p++;
  let s = 0;
  while (s < max - p && text[text.length - 1 - s] === prevText[prevText.length - 1 - s]) s++;

  const inserted = text.slice(p, text.length - s);
  const canon =
    displayToCanon(text.slice(0, p)) + chunkToCanon(inserted) + displayToCanon(text.slice(text.length - s));

  /* One decimal mark (the first wins — a second "," / "." is ignored), at most
   * `decimals` digits after it, no leading zeros on the integer part. */
  const mark = canon.indexOf('.');
  let int = mark < 0 ? canon : canon.slice(0, mark);
  int = int.replace(/^0+(?=\d)/, '');
  if (mark < 0 || decimals <= 0) return int;
  const frac = canon.slice(mark + 1).replace(/\./g, '').slice(0, decimals);
  return `${int === '' ? '0' : int}.${frac}`;
}
