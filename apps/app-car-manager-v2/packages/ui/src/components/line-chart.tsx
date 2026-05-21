'use client';
import {
  CartesianGrid,
  Line,
  LineChart as RLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface LineSeries {
  key: string;
  name: string;
  color: string;
}

interface LineChartProps<T extends Record<string, unknown>> {
  data: T[];
  xKey: keyof T & string;
  series: LineSeries[];
  height?: number;
  /* Suffix appended to formatted values (e.g. "M" → "12.4M").
   * Use this instead of a callback so Server Components can pass it. */
  valueSuffix?: string;
  valuePrecision?: number;
}

export function LineChart<T extends Record<string, unknown>>({
  data,
  xKey,
  series,
  height = 240,
  valueSuffix = '',
  valuePrecision = 0,
}: LineChartProps<T>) {
  const fmt = (v: number) => `${v.toFixed(valuePrecision)}${valueSuffix}`;
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RLineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fill: 'hsl(var(--text-muted))', fontSize: 11 }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'hsl(var(--text-muted))', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={fmt}
          />
          <Tooltip
            cursor={{ stroke: 'hsl(var(--border-strong))', strokeWidth: 1 }}
            contentStyle={{
              background: 'hsl(var(--surface))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
              padding: '8px 12px',
              boxShadow: '0 8px 24px rgb(15 23 42 / 0.12)',
            }}
            formatter={(value: number, name) => [fmt(value), name]}
          />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          ))}
        </RLineChart>
      </ResponsiveContainer>
    </div>
  );
}
