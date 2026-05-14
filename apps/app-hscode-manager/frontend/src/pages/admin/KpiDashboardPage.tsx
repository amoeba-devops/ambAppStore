import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { adminService } from '@/services/admin.service';

function MetricCard({
  label,
  value,
  format,
  hint,
  color,
}: {
  label: string;
  value: number;
  format: 'percent' | 'count' | 'money' | 'ms';
  hint?: string;
  color?: 'green' | 'amber' | 'red' | 'blue';
}) {
  const formatted =
    format === 'percent'
      ? `${(value * 100).toFixed(2)}%`
      : format === 'money'
        ? `$${value.toLocaleString()}`
        : format === 'ms'
          ? `${value} ms`
          : value.toLocaleString();
  return (
    <div className="card">
      <div className="text-xs text-gray-500">{label}</div>
      <div
        className={clsx(
          'mt-1 font-mono text-2xl font-bold',
          color === 'green' && 'text-green-700',
          color === 'amber' && 'text-amber-700',
          color === 'red' && 'text-red-700',
          color === 'blue' && 'text-blue-700',
          !color && 'text-gray-900',
        )}
      >
        {formatted}
      </div>
      {hint && <div className="mt-0.5 text-xs text-gray-500">{hint}</div>}
    </div>
  );
}

function TrendBar({
  label,
  values,
  max,
  color,
}: {
  label: string;
  values: number[];
  max: number;
  color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-gray-600">{label}</div>
      <div className="flex h-16 items-end gap-1">
        {values.map((v, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end">
            <span className="text-[10px] font-mono text-gray-500">{v}</span>
            <div
              className="w-full rounded-sm"
              style={{
                height: `${Math.max(2, (v / Math.max(1, max)) * 56)}px`,
                backgroundColor: color,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function KpiDashboardPage() {
  const { t } = useTranslation('admin');
  const [months, setMonths] = useState(6);

  const { data, isLoading } = useQuery({
    queryKey: ['kpi-dashboard', months],
    queryFn: () => adminService.kpiDashboard(months),
  });

  if (isLoading || !data) {
    return <div className="p-6 text-sm text-gray-400">…</div>;
  }

  const trendMax = Math.max(
    1,
    ...data.monthlyTrend.flatMap((m) => [
      m.adopted,
      m.superseded,
      m.sealed,
      m.seizureCount,
    ]),
  );

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-end justify-between">
        <h2 className="text-xl font-bold text-gray-900">{t('kpi.title')}</h2>
        <label className="text-sm">
          <span className="text-gray-600">{t('kpi.period_label')}</span>
          <select
            className="input ml-2 w-20"
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
          >
            {[1, 3, 6, 12].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </header>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">
          4대 KPI · {months}개월
        </h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard
            label={t('kpi.rank1_hit')}
            value={data.rank1HitRate}
            format="percent"
            color="green"
          />
          <MetricCard
            label={t('kpi.seizure')}
            value={data.seizureRate}
            format="percent"
            color="red"
          />
          <MetricCard
            label={t('kpi.correction')}
            value={data.correctionRate}
            format="percent"
            color="amber"
          />
          <MetricCard
            label={t('kpi.sealed')}
            value={data.sealedRate}
            format="percent"
            color="blue"
          />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">{t('kpi.totals')}</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <MetricCard label="Adopted" value={data.totals.adopted} format="count" />
          <MetricCard label="Sealed" value={data.totals.sealed} format="count" />
          <MetricCard
            label="Superseded"
            value={data.totals.superseded}
            format="count"
          />
          <MetricCard
            label="Disputed"
            value={data.totals.disputed}
            format="count"
            color="red"
          />
          <MetricCard
            label="Seizure events"
            value={data.totals.seizureEvents}
            format="count"
            color="red"
          />
          <MetricCard
            label="Seizure USD"
            value={data.totals.seizureAmountUsd}
            format="money"
            color="red"
          />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">{t('kpi.ai')}</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <MetricCard label="Calls" value={data.ai.totalCalls} format="count" />
          <MetricCard label="OK rate" value={data.ai.okRate} format="percent" color="green" />
          <MetricCard
            label="Hallucination"
            value={data.ai.hallucinationRate}
            format="percent"
            color="red"
          />
          <MetricCard label="Avg latency" value={data.ai.avgLatencyMs} format="ms" />
          <MetricCard
            label="Cost"
            value={data.ai.totalCostUsd}
            format="money"
            color="amber"
          />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">{t('kpi.trend')}</h3>
        <div className="card space-y-3">
          <div className="grid grid-cols-6 gap-3 text-center text-[10px] font-mono text-gray-500">
            {data.monthlyTrend.map((m) => (
              <div key={m.yearMonth}>{m.yearMonth.slice(2)}</div>
            ))}
          </div>
          <TrendBar
            label="Adopted"
            values={data.monthlyTrend.map((m) => m.adopted)}
            max={trendMax}
            color="#16a34a"
          />
          <TrendBar
            label="Superseded"
            values={data.monthlyTrend.map((m) => m.superseded)}
            max={trendMax}
            color="#f59e0b"
          />
          <TrendBar
            label="Sealed"
            values={data.monthlyTrend.map((m) => m.sealed)}
            max={trendMax}
            color="#2563eb"
          />
          <TrendBar
            label="Seizure"
            values={data.monthlyTrend.map((m) => m.seizureCount)}
            max={trendMax}
            color="#dc2626"
          />
        </div>
      </section>
    </div>
  );
}
