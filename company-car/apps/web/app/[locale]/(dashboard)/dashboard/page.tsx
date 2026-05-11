'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/client/api';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Car, Wrench, Users, Calendar as CalendarIcon } from 'lucide-react';
import type { CostType } from '@repo/api-types';

type DashboardData = {
  vehicles: { inUse: number; available: number; maintenance: number };
  period: {
    from: string;
    to: string;
    totalTrips: number;
    totalCost: number;
    totalCostByType: Record<CostType, number>;
    topPassengers: Array<{ userId: string; fullName: string; tripCount: number }>;
    costByVehicle: Array<{ vehicleId: string; licensePlate: string; total: number }>;
    costOverTime: Array<{ date: string; total: number }>;
  };
};

function defaultRange() {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

const FORMAT_VND = (v: number) => `${(v / 1_000_000).toFixed(1)}M`;

export default function DashboardPage() {
  const t = useTranslations();
  const [range, setRange] = useState(defaultRange());
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ from: range.from, to: range.to });
    apiFetch<DashboardData>(`/api/reports/dashboard?${params}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [range]);

  const costByTypeArray = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.period.totalCostByType).map(([type, total]) => ({
      type,
      total,
      label: t(`cost.type.${type}`),
    }));
  }, [data, t]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('dashboard.title')}</h1>
        <div className="flex items-center gap-2 text-sm">
          <input
            type="date"
            value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            className="rounded-lg border border-border bg-background px-3 py-1.5"
          />
          <span className="text-muted-foreground">→</span>
          <input
            type="date"
            value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            className="rounded-lg border border-border bg-background px-3 py-1.5"
          />
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label={t('dashboard.vehiclesInUse')} value={data?.vehicles.inUse ?? '—'} icon={<Car className="h-5 w-5" />} accent="blue" />
        <KpiCard label={t('dashboard.vehiclesAvailable')} value={data?.vehicles.available ?? '—'} icon={<Car className="h-5 w-5" />} accent="green" />
        <KpiCard label={t('dashboard.vehiclesMaintenance')} value={data?.vehicles.maintenance ?? '—'} icon={<Wrench className="h-5 w-5" />} accent="amber" />
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          label="Trips"
          value={data?.period.totalTrips ?? '—'}
          icon={<CalendarIcon className="h-5 w-5" />}
          accent="indigo"
        />
        <KpiCard
          label="Total cost"
          value={data ? `${(data.period.totalCost / 1_000_000).toFixed(1)}M` : '—'}
          icon={<Wrench className="h-5 w-5" />}
          accent="violet"
        />
        <KpiCard
          label="Top passengers"
          value={data?.period.topPassengers.length ?? '—'}
          icon={<Users className="h-5 w-5" />}
          accent="emerald"
        />
        <KpiCard
          label={t('cost.type.FUEL')}
          value={
            data ? `${(data.period.totalCostByType.FUEL / 1_000_000).toFixed(1)}M` : '—'
          }
          icon={<Car className="h-5 w-5" />}
          accent="orange"
        />
      </section>

      {!loading && data && (
        <>
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Cost by vehicle">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.period.costByVehicle}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="licensePlate" fontSize={12} />
                  <YAxis tickFormatter={FORMAT_VND} fontSize={12} />
                  <Tooltip formatter={(v: number) => `${v.toLocaleString()} VND`} />
                  <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Cost over time">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.period.costOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis tickFormatter={FORMAT_VND} fontSize={12} />
                  <Tooltip formatter={(v: number) => `${v.toLocaleString()} VND`} />
                  <Line type="monotone" dataKey="total" stroke="#16a34a" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Panel>
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Cost by type">
              <ul className="space-y-2 text-sm">
                {costByTypeArray.map((c) => (
                  <li key={c.type} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <span>{c.label}</span>
                    <span className="font-mono tabular-nums">{c.total.toLocaleString()} VND</span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Top passengers">
              {data.period.topPassengers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No trips in period.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.period.topPassengers.map((p, i) => (
                    <li key={p.userId} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                      <span>
                        <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs">
                          {i + 1}
                        </span>
                        {p.fullName}
                      </span>
                      <span className="text-muted-foreground">{p.tripCount} trips</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </section>
        </>
      )}

      {loading && <div className="text-center text-sm text-muted-foreground">{t('common.loading')}</div>}
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent: 'blue' | 'green' | 'amber' | 'indigo' | 'violet' | 'emerald' | 'orange';
}) {
  const accentMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    violet: 'bg-violet-50 text-violet-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    orange: 'bg-orange-50 text-orange-600',
  };
  return (
    <div className="rounded-2xl border border-border bg-background p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className={`rounded-lg p-2 ${accentMap[accent]}`}>{icon}</div>
      </div>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-5">
      <h2 className="mb-4 text-base font-medium">{title}</h2>
      {children}
    </div>
  );
}
