type Props = {
  values: number[];
  color?: string;
  fill?: string;
  height?: number;
};

export function Spark({ values, color = '#3182f6', fill = '#dbeafe', height = 36 }: Props) {
  const w = 200;
  const h = height;
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const denom = values.length - 1 || 1;
  const pts = values.map((v, i): [number, number] => [
    i * (w / denom),
    h - 4 - ((v - min) / range) * (h - 8),
  ]);
  const d = 'M ' + pts.map((p) => p.map((n) => n.toFixed(1)).join(' ')).join(' L ');
  const fillD = `${d} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height }}
    >
      <path d={fillD} fill={fill} opacity="0.55" />
      <path d={d} stroke={color} strokeWidth="1.6" fill="none" />
    </svg>
  );
}
