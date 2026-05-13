'use client';

import { useMemo, useState } from 'react';
import { fmtCompact } from '@/lib/format';

interface Point {
  label: string;
  value: number;
}

interface MiniLineChartProps {
  data: Point[];
  /** Tailwind stroke color class, e.g., "stroke-shopee" */
  stroke: string;
  /** Tailwind fill class for the area under the line (with opacity), e.g., "fill-shopee/10" */
  fill: string;
  /** Tailwind fill class for the dots (solid), e.g., "fill-shopee" */
  dot?: string;
  height?: number;
  /** Tooltip value formatter. Default: locale thousand separators. */
  formatValue?: (value: number) => string;
}

export function MiniLineChart({ data, stroke, fill, dot, height = 220, formatValue }: MiniLineChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const fmt = formatValue ?? ((v: number) => new Intl.NumberFormat('en-US').format(Math.round(v)));

  const { viewBox, linePath, areaPath, yTicks, points, plotLeft, plotRight, plotBottom } = useMemo(() => {
    const w = 600;
    const h = height;
    const padLeft = 56;
    const padRight = 16;
    const padTop = 20;
    const padBottom = 32;
    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    const values = data.map((p) => p.value);
    const maxRaw = Math.max(...values, 0);
    const minRaw = Math.min(...values, 0);
    const range = maxRaw - minRaw || 1;
    const step = niceStep(range / 4);
    const yMin = Math.floor(minRaw / step) * step;
    const yMax = Math.ceil(maxRaw / step) * step;

    const xStep = data.length > 1 ? plotW / (data.length - 1) : plotW / 2;
    const yScale = (v: number) =>
      padTop + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;
    const xScale = (i: number) => padLeft + i * xStep;

    const points = data.map((p, i) => ({ x: xScale(i), y: yScale(p.value), label: p.label, value: p.value }));

    const linePath = points
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`)
      .join(' ');

    const baselineY = yScale(yMin);
    const areaPath =
      points.length === 0
        ? ''
        : `M ${points[0]!.x.toFixed(2)} ${baselineY.toFixed(2)} ` +
          points.map((pt) => `L ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`).join(' ') +
          ` L ${points[points.length - 1]!.x.toFixed(2)} ${baselineY.toFixed(2)} Z`;

    const ticks: { y: number; value: number }[] = [];
    for (let v = yMax; v >= yMin; v -= step) {
      ticks.push({ y: yScale(v), value: v });
    }

    return {
      viewBox: `0 0 ${w} ${h}`,
      linePath,
      areaPath,
      yTicks: ticks,
      points,
      plotLeft: padLeft,
      plotRight: w - padRight,
      plotBottom: h - padBottom,
    };
  }, [data, height]);

  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-neutral-400">
        No data
      </div>
    );
  }

  const dotClass = dot ?? stroke.replace('stroke-', 'fill-');

  // Compute tooltip x with clamp inside plot area so it doesn't overflow.
  const tooltipFor = hovered != null ? points[hovered] : null;
  const tooltipText = tooltipFor ? fmt(tooltipFor.value) : '';
  // Approximate text width (assume 7px per char) to clamp
  const approxWidth = tooltipText.length * 7 + 16;
  const tooltipCx = tooltipFor
    ? Math.min(Math.max(tooltipFor.x, plotLeft + approxWidth / 2), plotRight - approxWidth / 2)
    : 0;
  const tooltipY = tooltipFor ? Math.max(tooltipFor.y - 28, 18) : 0;

  return (
    <svg viewBox={viewBox} width="100%" height={height} className="overflow-visible">
      {/* Grid lines */}
      {yTicks.map((t, i) => (
        <line
          key={i}
          x1={plotLeft}
          y1={t.y}
          x2={plotRight}
          y2={t.y}
          className="stroke-neutral-200"
          strokeWidth={1}
        />
      ))}

      {/* Y-axis labels */}
      {yTicks.map((t, i) => (
        <text
          key={`label-${i}`}
          x={plotLeft - 8}
          y={t.y + 4}
          textAnchor="end"
          className="fill-neutral-500 text-[10px] font-mono tabular-nums"
        >
          {fmtCompact(t.value, 2)}
        </text>
      ))}

      {/* Area */}
      <path d={areaPath} className={fill} />

      {/* Line */}
      <path d={linePath} className={stroke} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />

      {/* X-axis labels */}
      {points.map((pt, i) => (
        <text
          key={`x-${i}`}
          x={pt.x}
          y={plotBottom + 16}
          textAnchor="middle"
          className="fill-neutral-500 text-[10px] font-mono"
        >
          {pt.label}
        </text>
      ))}

      {/* Dots + invisible hit targets */}
      {points.map((pt, i) => {
        const isHovered = hovered === i;
        return (
          <g key={`dot-${i}`}>
            <circle
              cx={pt.x}
              cy={pt.y}
              r={isHovered ? 5 : 3.5}
              className={`${dotClass} transition-all`}
              stroke="white"
              strokeWidth={2}
            />
            <circle
              cx={pt.x}
              cy={pt.y}
              r={14}
              fill="transparent"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered((v) => (v === i ? null : v))}
              style={{ cursor: 'pointer' }}
            />
          </g>
        );
      })}

      {/* Tooltip */}
      {tooltipFor && (
        <g pointerEvents="none">
          <rect
            x={tooltipCx - approxWidth / 2}
            y={tooltipY - 14}
            width={approxWidth}
            height={22}
            rx={4}
            className="fill-white"
            stroke="currentColor"
            strokeWidth={1}
            style={{ color: 'rgba(0,0,0,0.08)' }}
          />
          <text
            x={tooltipCx}
            y={tooltipY + 2}
            textAnchor="middle"
            className="fill-neutral-900 text-xs font-mono font-semibold tabular-nums"
          >
            {tooltipText}
          </text>
        </g>
      )}
    </svg>
  );
}

function niceStep(rough: number): number {
  if (rough <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  let nice: number;
  if (norm < 1.5) nice = 1;
  else if (norm < 3) nice = 2;
  else if (norm < 7) nice = 5;
  else nice = 10;
  return nice * mag;
}
