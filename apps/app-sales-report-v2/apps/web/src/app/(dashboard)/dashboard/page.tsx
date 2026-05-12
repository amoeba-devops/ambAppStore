import { fmtVND, fmtKRW, fmtInt, fmtPct } from '@/lib/format';

const MOCK_KPIS = {
  netGmvVnd: 1_682_035_200,
  cmVnd: 338_812_085,
  cmRatio: 0.2014,
  orders: 4159,
  aovVnd: 455_956,
  itemSold: 5187,
  fxRate: 17.543,
};

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</div>
      <div
        className={`mt-2 font-mono text-2xl tabular ${accent ? 'text-accent-700' : 'text-neutral-900'}`}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-neutral-500">{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const k = MOCK_KPIS;
  return (
    <div className="space-y-6">
      <div className="rounded-md bg-warning-50 px-4 py-2 text-xs text-warning-500">
        Demo data — Apr 2026. Real KPIs sau khi implement F-1 Upload + F-4 Weekly Report.
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Net GMV"
          value={fmtVND(k.netGmvVnd)}
          sub={fmtKRW(k.netGmvVnd / k.fxRate)}
          accent
        />
        <KpiCard
          label="Contribution Margin"
          value={fmtVND(k.cmVnd)}
          sub={fmtPct(k.cmRatio) + ' of Net GMV'}
        />
        <KpiCard label="Orders" value={fmtInt(k.orders)} sub={`AOV ${fmtVND(k.aovVnd)}`} />
        <KpiCard label="Items Sold" value={fmtInt(k.itemSold)} />
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-neutral-900">Recent activity</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Activity feed sẽ hiển thị 5 actions gần nhất sau khi F-5 Activity Logs ready.
        </p>
      </div>
    </div>
  );
}
