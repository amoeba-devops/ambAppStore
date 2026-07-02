'use client';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface StackedSeries {
  key: string;
  name: string;
  color: string;
}

interface StackedBarChartProps<T extends Record<string, unknown>> {
  data: T[];
  /* The X-axis category field name. */
  xKey: keyof T & string;
  series: StackedSeries[];
  height?: number;
  /* Optional suffix appended to tooltip + Y-axis values (e.g. "M" → "12.4M").
   * Functions can't cross the Server → Client boundary in RSC, so prefer this
   * over a formatter callback when callers are Server Components. */
  valueSuffix?: string;
  /* Number of decimal places used when formatting (default 0). */
  valuePrecision?: number;
  /* Stack the series (default) or render them grouped side-by-side. Grouped is
   * right when series aren't additive (e.g. revenue vs profit). */
  stacked?: boolean;
}

export function StackedBarChart<T extends Record<string, unknown>>({
  data,
  xKey,
  series,
  height = 240,
  valueSuffix = '',
  valuePrecision = 0,
  stacked = true,
}: StackedBarChartProps<T>) {
  const fmt = (v: number) => `${v.toFixed(valuePrecision)}${valueSuffix}`;
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
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
            cursor={{ fill: 'hsl(var(--surface-2) / 0.5)' }}
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
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              stackId={stacked ? 'a' : undefined}
              fill={s.color}
              radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
