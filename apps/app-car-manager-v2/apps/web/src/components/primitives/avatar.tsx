type Palette = [string, string]; // [bg, fg]

const PALETTE: Palette[] = [
  ['bg-brand-100',   'text-brand-700'],
  ['bg-purple-100',  'text-purple-700'],
  ['bg-teal-100',    'text-teal-700'],
  ['bg-warning-100', 'text-warning-700'],
  ['bg-success-100', 'text-success-700'],
  ['bg-danger-100',  'text-danger-700'],
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();
}

type Props = { name: string; size?: number };

export function Avatar({ name, size = 28 }: Props) {
  const palette = PALETTE[hashName(name) % PALETTE.length] ?? PALETTE[0]!;
  return (
    <div
      className={`flex items-center justify-center rounded-full font-bold tracking-[-0.02em] flex-shrink-0 ${palette[0]} ${palette[1]}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initials(name)}
    </div>
  );
}
