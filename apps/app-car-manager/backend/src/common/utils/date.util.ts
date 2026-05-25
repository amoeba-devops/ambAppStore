// MySQL DATE columns are returned as strings by the mysql2 driver, but TypeORM
// can hand them back as Date objects when an entity was just saved. This helper
// normalises both cases to a 'YYYY-MM-DD' string (or null).
export function toDateString(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string') {
    return value.length >= 10 ? value.slice(0, 10) : value;
  }
  return null;
}
