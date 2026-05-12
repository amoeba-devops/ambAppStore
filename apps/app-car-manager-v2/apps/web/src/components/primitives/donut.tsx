type Slice = { value: number; color: string };
type Props = {
  data: Slice[];
  size?: number;
  thickness?: number;
};

export function Donut({ data, size = 140, thickness = 18 }: Props) {
  const sum = data.reduce((a, b) => a + b.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let off = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#f1f3f6"
        strokeWidth={thickness}
      />
      {data.map((d, i) => {
        const len = (d.value / sum) * c;
        const seg = (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={d.color}
            strokeWidth={thickness}
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-off}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            strokeLinecap="butt"
          />
        );
        off += len;
        return seg;
      })}
    </svg>
  );
}
