// Minimal CSV helpers — RFC 4180 subset: comma delimiter, double-quote escape, CRLF or LF.

export function escapeCsvField(value: string | number | null | undefined): string {
  if (value == null) return '';
  const s = typeof value === 'number' ? value.toString() : value;
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function toCsvRow(fields: Array<string | number | null | undefined>): string {
  return fields.map(escapeCsvField).join(',');
}

export function buildCsv(header: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const lines = [toCsvRow(header), ...rows.map(toCsvRow)];
  // Prepend BOM so Excel opens UTF-8 correctly
  return '﻿' + lines.join('\r\n');
}

export function parseCsv(text: string): string[][] {
  // Strip BOM if present
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = input.length;

  while (i < n) {
    const ch = input[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\r') {
      // Handle CRLF or lone CR
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      if (input[i + 1] === '\n') i += 2;
      else i++;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += ch;
    i++;
  }

  // Flush last field/row if non-empty
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
