/**
 * Two-line "last updated" cell — time on top (HH:MM:SS), date below
 * (DD/MM/YYYY). Shared by the truck roster/log/finance tables so every
 * "Cập nhật" column renders the same way (Sheet-2: T8, DR7, F7, P7).
 * Pure/formatting only — safe to use inside Server Components.
 */
export function DateTimeCell({
  value,
  locale,
}: {
  value: Date | string | null | undefined;
  locale: string;
}) {
  if (!value) return <span className="text-text-faint">—</span>;
  const d = new Date(value);
  const time = d.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const date = d.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return (
    <div className="leading-tight tabular whitespace-nowrap">
      <div className="text-text">{time}</div>
      <div className="text-xs text-text-faint">{date}</div>
    </div>
  );
}
