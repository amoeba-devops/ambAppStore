import { getTranslations } from 'next-intl/server';
import { AppFrame } from '@/components/layout/app-frame';
import { Btn } from '@/components/primitives/btn';
import { Card } from '@/components/primitives/card';
import { KPI } from '@/components/primitives/kpi';
import { Spark } from '@/components/primitives/spark';
import { Donut } from '@/components/primitives/donut';
import { Avatar } from '@/components/primitives/avatar';
import { FleetCard } from '@/components/dashboard/fleet-card';
import { ActionItem } from '@/components/dashboard/action-item';
import { WeekCalendar } from '@/components/dashboard/week-calendar';
import { StackedSpend } from '@/components/dashboard/stacked-spend';

// Sample data — ported verbatim from design/project/tokens.jsx SAMPLE.
const VEHICLES = [
  { plate: '51K-238.91', model: 'Hyundai Staria 11', color: 'Pearl White', km: 18420, driver: 'Nguyễn Văn Tú',  nextOil:  1580 },
  { plate: '30A-556.07', model: 'Kia Carnival SX',   color: 'Aurora Black', km: 42118, driver: 'Trần Quốc Hùng', nextOil:  -210 },
  { plate: '51F-712.34', model: 'Toyota Camry 2.5Q', color: 'Silver',       km: 67830, driver: 'Lê Minh Đức',    nextOil:  2940 },
] as const;

const TOP_USERS = [
  { n: 'Park Joon-ho',  t: 'CEO',                   trips: 14, spend: '3.8M₫', pct: 100 },
  { n: 'Kim Min-seo',   t: 'Director, Operations',  trips: 11, spend: '2.6M₫', pct: 78 },
  { n: 'Choi Ji-woo',   t: 'Director, Sales',       trips:  8, spend: '1.9M₫', pct: 57 },
  { n: 'Nguyễn Thu Hà', t: 'VP, Finance',           trips:  5, spend: '1.3M₫', pct: 36 },
  { n: 'Lee Hyun-jung', t: 'Manager, IT',           trips:  3, spend: '0.7M₫', pct: 21 },
] as const;

const SPEND_MIX = [
  { name: 'Fuel',     color: '#3182f6', amount: '6.2M₫', pct: '42%', value: 42 },
  { name: 'Repair',   color: '#7a5af8', amount: '4.1M₫', pct: '28%', value: 28 },
  { name: 'Meal',     color: '#f79009', amount: '2.1M₫', pct: '14%', value: 14 },
  { name: 'Oil',      color: '#14b8a6', amount: '1.3M₫', pct:  '9%', value:  9 },
  { name: 'Accident', color: '#f04438', amount: '1.0M₫', pct:  '7%', value:  7 },
] as const;

export default async function DashboardPage() {
  const t = await getTranslations('screens.dashboardA');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const tAct = await getTranslations('actions');

  return (
    <AppFrame
      title={t('title')}
      subtitle={t('subtitle')}
      breadcrumbs={[tCo('tenant'), tNav('dashboard')]}
      actions={
        <>
          <Btn kind="ghost" icon="calendar">{t('dateRange')}</Btn>
          <Btn kind="ghost" icon="download">{tAct('export')}</Btn>
          <Btn kind="primary" icon="plus">{t('newTrip')}</Btn>
        </>
      }
    >
      <div className="h-full overflow-auto px-7 pt-6 pb-8">
        {/* KPI row */}
        <div className="grid grid-cols-4 gap-3.5">
          <KPI
            label={t('kTrips')}
            value="28"
            delta="+12%"
            deltaKind="up"
            spark={<Spark values={[3, 5, 4, 6, 5, 7, 8, 4, 6, 9]} />}
            accent="#3182f6"
          />
          <KPI
            label={t('kSpend')}
            value="14.8M₫"
            delta="+4.2%"
            deltaKind="up"
            spark={<Spark values={[2, 4, 3, 6, 5, 8, 7, 5, 9, 11]} color="#7a5af8" fill="#ebe9fe" />}
            accent="#7a5af8"
          />
          <KPI
            label={t('kPending')}
            value="4"
            delta="2 / 24h"
            deltaKind="down"
            spark={<Spark values={[1, 2, 1, 3, 2, 2, 4, 3, 4, 4]} color="#f79009" fill="#fef0c7" />}
            accent="#f79009"
          />
          <KPI
            label={t('kUtil')}
            value="73%"
            delta="+8 pts"
            deltaKind="up"
            spark={<Spark values={[40, 55, 52, 60, 68, 65, 72, 70, 73, 73]} color="#12b76a" fill="#d1fadf" />}
            accent="#12b76a"
          />
        </div>

        {/* Fleet status + Spend mix */}
        <div className="grid grid-cols-[1.4fr_1fr] gap-3.5 mt-3.5">
          <Card
            title={t('fleetTitle')}
            subtitle={t('fleetSubtitle')}
            action={<Btn kind="ghost" size="sm" iconRight="arrow-r">{t('viewAll')}</Btn>}
          >
            <div className="grid grid-cols-3 gap-3">
              <FleetCard
                v={VEHICLES[0]}
                state="running"
                trip={{ from: 'District 1, HCMC', to: 'Tan Son Nhat T2', driver: 'Nguyễn Văn Tú', remaining: '22 min' }}
              />
              <FleetCard
                v={VEHICLES[1]}
                state="ready"
                next={{ to: 'Long Hậu IZ', at: '15:30' }}
              />
              <FleetCard
                v={VEHICLES[2]}
                state="maintenance"
                detail="Periodic service · ETA back: tomorrow 10:00"
              />
            </div>
          </Card>

          <Card
            title={t('spendTitle')}
            subtitle={t('spendSubtitle')}
            action={<Btn kind="ghost" size="sm">{t('compact')}</Btn>}
          >
            <div className="flex items-center gap-6">
              <Donut size={148} thickness={20} data={SPEND_MIX.map((s) => ({ value: s.value, color: s.color }))} />
              <div className="flex-1 flex flex-col gap-2">
                {SPEND_MIX.map((s) => (
                  <div key={s.name} className="flex items-center gap-2.5 text-[12.5px]">
                    <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                    <span className="flex-1 text-neutral-700 font-semibold">{s.name}</span>
                    <span className="text-neutral-500 tabular">{s.amount}</span>
                    <span className="w-8 text-right text-neutral-400 tabular">{s.pct}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Calendar + Action queue */}
        <div className="grid grid-cols-[1.6fr_1fr] gap-3.5 mt-3.5">
          <Card
            title={t('schedTitle')}
            subtitle={t('schedSubtitle')}
            padding={0}
            action={
              <div className="flex gap-1.5 px-3 pt-2">
                <Btn kind="soft" size="sm">{t('day')}</Btn>
                <Btn size="sm" className="bg-neutral-800 text-white border-neutral-800 hover:bg-neutral-900">
                  {t('week')}
                </Btn>
                <Btn kind="ghost" size="sm">{t('month')}</Btn>
              </div>
            }
          >
            <WeekCalendar />
          </Card>

          <Card title={t('queueTitle')} subtitle={t('queueSubtitle')} padding={16}>
            <div className="flex flex-col">
              <ActionItem
                icon="alert" iconColor="#dc6803" bg="#fffaeb"
                title="Approve repair — 51F-712.34"
                meta="Submitted by Lê Minh Đức · 4.2M₫ · 35 min ago"
                tag="High" tagKind="danger"
              />
              <ActionItem
                icon="fuel" iconColor="#2566db" bg="#eff6ff"
                title="Approve fuel — 30A-556.07"
                meta="Trần Quốc Hùng · 1,250,000₫ · 2 hr ago"
                tag="Threshold exceeded" tagKind="warn"
              />
              <ActionItem
                icon="wrench" iconColor="#0d9488" bg="#f0fdfa"
                title="Oil change due — 30A-556.07"
                meta="210 km past interval · scheduled by Admin"
                tag="Service" tagKind="info"
              />
              <ActionItem
                icon="user" iconColor="#d92d20" bg="#fef3f2"
                title="License expiry — Lê Minh Đức"
                meta="Expires May 22 · 10 days left"
                tag="License" tagKind="danger"
              />
              <ActionItem
                icon="trips" iconColor="#6938ef" bg="#f4f3ff"
                title="Reassign driver — TR-1042"
                meta="Trần Quốc Hùng rejected · 'Family appointment'"
                tag="Reassign" tagKind="purple"
              />
            </div>
          </Card>
        </div>

        {/* Stacked spend chart + Top users */}
        <div className="grid grid-cols-[1.5fr_1fr] gap-3.5 mt-3.5">
          <Card
            title={t('chartTitle')}
            subtitle={t('chartSubtitle')}
            action={
              <div className="flex gap-3.5 text-[11.5px] text-neutral-500 font-semibold">
                <Legend color="#3182f6" label="Fuel" />
                <Legend color="#7a5af8" label="Repair" />
                <Legend color="#f79009" label="Meal" />
                <Legend color="#14b8a6" label="Oil" />
              </div>
            }
          >
            <StackedSpend />
          </Card>

          <Card title={t('topTitle')} subtitle={t('topSubtitle')}>
            <div className="flex flex-col">
              {TOP_USERS.map((u, i) => (
                <div
                  key={u.n}
                  className={`flex items-center gap-3 py-2.5 ${
                    i < TOP_USERS.length - 1 ? 'border-b border-neutral-75' : ''
                  }`}
                >
                  <Avatar name={u.n} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-neutral-800">{u.n}</div>
                    <div className="text-[11.5px] text-neutral-400">{u.t}</div>
                  </div>
                  <div className="w-20">
                    <div className="h-1.5 bg-neutral-75 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500" style={{ width: `${u.pct}%` }} />
                    </div>
                  </div>
                  <div className="w-10 text-right text-[13px] font-bold text-neutral-800 tabular">
                    {u.trips}
                  </div>
                  <div className="w-14 text-right text-[12px] text-neutral-500 tabular">
                    {u.spend}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppFrame>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
