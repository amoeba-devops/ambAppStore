'use client';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '../cn.js';

export interface DonutDatum {
  name: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutDatum[];
  size?: number;
  thickness?: number;
  centerLabel?: React.ReactNode;
  centerValue?: React.ReactNode;
  className?: string;
}

export function DonutChart({
  data,
  size = 180,
  thickness = 20,
  centerLabel,
  centerValue,
  className,
}: DonutChartProps) {
  const outer = size / 2;
  const inner = outer - thickness;
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            innerRadius={inner}
            outerRadius={outer}
            paddingAngle={1}
            dataKey="value"
            stroke="none"
            isAnimationActive={false}
          >
            {data.map((d) => <Cell key={d.name} fill={d.color} />)}
          </Pie>
          <Tooltip
            cursor={{ fill: 'transparent' }}
            contentStyle={{
              background: 'hsl(var(--surface))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
              padding: '6px 10px',
              boxShadow: '0 8px 24px rgb(15 23 42 / 0.12)',
            }}
            formatter={(value: number, name) => [value, name]}
          />
        </PieChart>
      </ResponsiveContainer>
      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {centerValue && <div className="text-xl font-bold text-text tabular leading-none">{centerValue}</div>}
          {centerLabel && <div className="text-xs text-text-muted mt-1">{centerLabel}</div>}
        </div>
      )}
    </div>
  );
}
