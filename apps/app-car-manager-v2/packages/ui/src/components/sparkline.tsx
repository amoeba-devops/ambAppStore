'use client';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { cn } from '../cn.js';

interface SparklineProps {
  data: number[];
  color?: string;
  fill?: string;
  height?: number;
  className?: string;
}

export function Sparkline({ data, color = 'hsl(var(--accent))', fill, height = 36, className }: SparklineProps) {
  const points = data.map((v, i) => ({ i, v }));
  const id = `spark-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={fill ?? color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={fill ?? color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.75}
            fill={`url(#${id})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
