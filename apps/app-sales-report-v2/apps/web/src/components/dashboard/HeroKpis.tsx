'use client';

import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@v2/ui';
import { combinedMetric, getPeriodHeaderLabel, type WeekPoint } from '@/lib/trends-mock';
import { fmtCompact } from '@/lib/format';
import { MiniLineChart } from '@/components/trends/MiniLineChart';

interface Props {
  weekPoints: WeekPoint[];
}

type KpiKind = 'money' | 'count' | 'ratio';

interface KpiSpec {
  key: 'netGmv' | 'totalCm' | 'cmPct' | 'orders';
  kind: KpiKind;
  /** Returns the metric value for a given week. Lets us compute CM% from CM/NetGMV. */
  read: (w: WeekPoint) => number;
}

const KPIS: KpiSpec[] = [
  {
    key: 'netGmv',
    kind: 'money',
    read: (w) => combinedMetric(w, 'NET_GMV'),
  },
  {
    key: 'totalCm',
    kind: 'money',
    read: (w) => combinedMetric(w, 'CM'),
  },
  {
    key: 'cmPct',
    kind: 'ratio',
    read: (w) => {
      const net = combinedMetric(w, 'NET_GMV');
      return net > 0 ? combinedMetric(w, 'CM') / net : 0;
    },
  },
  {
    key: 'orders',
    kind: 'count',
    read: (w) => combinedMetric(w, 'ORDERS'),
  },
];

function fmtValue(value: number, kind: KpiKind): React.ReactNode {
  if (kind === 'count') return new Intl.NumberFormat('en-US').format(Math.round(value));
  if (kind === 'ratio') return (value * 100).toFixed(2) + '%';
  return (
    <>
      {fmtCompact(value, 2)}
      <sub className="ml-0.5 text-xs text-neutral-400 font-normal align-baseline">₫</sub>
    </>
  );
}

function deltaText(curr: number, prev: number | null, kind: KpiKind): { text: string; positive: boolean | null } {
  if (prev == null) return { text: '—', positive: null };
  if (kind === 'ratio') {
    const diff = curr - prev;
    if (diff === 0) return { text: '0.0%', positive: null };
    const sign = diff > 0 ? '+' : '';
    return { text: `${sign}${(diff * 100).toFixed(1)}%`, positive: diff > 0 };
  }
  if (prev === 0) return { text: '—', positive: null };
  const pct = (curr - prev) / Math.abs(prev);
  if (pct === 0) return { text: '0.0%', positive: null };
  const sign = pct > 0 ? '+' : '';
  return { text: `${sign}${(pct * 100).toFixed(1)}%`, positive: pct > 0 };
}

export function HeroKpis({ weekPoints }: Props) {
  const t = useTranslations('dashboard.kpi');

  // Chronologically sorted ascending — already by snapshotsToWeekPoints.
  const latest = weekPoints[weekPoints.length - 1]!;
  const prev = weekPoints.length >= 2 ? weekPoints[weekPoints.length - 2]! : null;
  const sparkData = weekPoints.slice(-8);
  const latestLabel = `W${String(latest.weekNum).padStart(2, '0')}`;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-neutral-900">{t('sectionTitle')}</h2>
        <span className="text-xs text-neutral-500">{t('viaPeriod', { label: latestLabel })}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map((spec) => {
          const curr = spec.read(latest);
          const prevVal = prev ? spec.read(prev) : null;
          const d = deltaText(curr, prevVal, spec.kind);
          const series = sparkData.map((w) => ({
            label: getPeriodHeaderLabel(w),
            value: spec.read(w),
          }));
          return (
            <article
              key={spec.key}
              className="rounded-lg border border-neutral-200 bg-white px-5 py-4"
            >
              <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                {t(spec.key)}
              </div>
              <div className="mt-1.5 font-mono text-2xl font-semibold text-neutral-900 tabular-nums">
                {fmtValue(curr, spec.kind)}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <DeltaPill text={d.text} positive={d.positive} />
                <span className="text-[10px] text-neutral-400">{t('vsPrev')}</span>
              </div>
              {series.length >= 2 && (
                <div className="mt-3 -mx-1">
                  <MiniLineChart
                    data={series}
                    stroke="stroke-info-500"
                    fill="fill-info-500/10"
                    dot="fill-info-500"
                    formatValue={(v) =>
                      spec.kind === 'ratio'
                        ? (v * 100).toFixed(2) + '%'
                        : spec.kind === 'count'
                          ? new Intl.NumberFormat('en-US').format(Math.round(v))
                          : new Intl.NumberFormat('vi-VN').format(Math.round(v))
                    }
                  />
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DeltaPill({ text, positive }: { text: string; positive: boolean | null }) {
  const colorBg =
    positive === true
      ? 'bg-success-50 text-success-500'
      : positive === false
        ? 'bg-error-50 text-error-500'
        : 'bg-neutral-100 text-neutral-500';
  const Icon = positive === true ? ArrowUp : positive === false ? ArrowDown : Minus;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums',
        colorBg,
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {text}
    </span>
  );
}
