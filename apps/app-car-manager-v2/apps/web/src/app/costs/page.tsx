import { getTranslations } from 'next-intl/server';
import { Check, Download, Filter, Fuel, Receipt, Wrench, X } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardHeaderText,
  CardTitle,
  chartColors,
} from '@car-v2/ui';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';

type ExpenseType = 'FUEL' | 'OIL' | 'REPAIR' | 'PARKING' | 'TOLL' | 'MEAL' | 'ACCIDENT' | 'INSPECTION';

interface ExpenseRow {
  id: string;
  type: ExpenseType;
  amount: number;
  amountFmt: string;
  vehicle: string;
  driver: string;
  trip?: string;
  when: string;
  thresholdExceeded?: boolean;
}

const EXPENSE_TYPE_COLOR: Record<ExpenseType, string> = {
  FUEL:       chartColors[0],
  REPAIR:     chartColors[1],
  MEAL:       chartColors[2],
  OIL:        chartColors[3],
  ACCIDENT:   chartColors[4],
  PARKING:    chartColors[5],
  TOLL:       chartColors[6],
  INSPECTION: chartColors[7],
};

const EXPENSE_LABEL: Record<ExpenseType, string> = {
  FUEL: 'Fuel', OIL: 'Oil', REPAIR: 'Repair', PARKING: 'Parking', TOLL: 'Toll',
  MEAL: 'Meal', ACCIDENT: 'Accident', INSPECTION: 'Inspection',
};

const PENDING: ExpenseRow[] = [
  { id: 'e-512', type: 'REPAIR',   amount: 4_200_000, amountFmt: '4.2M₫',    vehicle: '51F-712.34', driver: 'Lê Minh Đức',     trip: 'TR-1030', when: '35 min ago' },
  { id: 'e-510', type: 'FUEL',     amount: 1_250_000, amountFmt: '1,250,000₫', vehicle: '30A-556.07', driver: 'Trần Quốc Hùng', trip: 'TR-1041', when: '2 hr ago',  thresholdExceeded: true },
  { id: 'e-509', type: 'ACCIDENT', amount:   850_000, amountFmt: '850,000₫',  vehicle: '51K-238.91', driver: 'Nguyễn Văn Tú',  trip: 'TR-1042', when: '3 hr ago' },
  { id: 'e-507', type: 'REPAIR',   amount:   620_000, amountFmt: '620,000₫',  vehicle: '51F-712.34', driver: 'Lê Minh Đức',                  when: 'Yesterday' },
];

export default async function CostsPage() {
  const t    = await getTranslations('screens.costList');
  const tA   = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo  = await getTranslations('company');

  // simulate selection for the right-pane preview
  const selected = PENDING[0]!;

  return (
    <AppShell>
      <PageHeader
        title="Approval queue"
        subtitle="4 expenses waiting · auto-approved hidden"
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('costs') }]}
        actions={
          <>
            <Button variant="ghost" size="md" iconLeft={<Filter />}>{tA('filter')}</Button>
            <Button variant="ghost" size="md" iconLeft={<Download />}>{tA('export')}</Button>
          </>
        }
      />

      <div className="flex-1 overflow-hidden flex flex-col md:grid md:grid-cols-[420px_1fr]">
        {/* List pane — full-width on mobile, fixed left rail on desktop.
         * Mobile shows ONLY the list; tapping a row navigates to detail. */}
        <aside className="md:border-r border-border bg-bg overflow-y-auto flex-1 md:flex-initial">
          <div className="px-4 md:px-5 py-3 flex items-center justify-between border-b border-border bg-surface/70 backdrop-blur sticky top-0 z-10">
            <div className="text-sm font-semibold text-text">Pending review · {PENDING.length}</div>
            <Badge tone="warning" size="sm">Needs you</Badge>
          </div>
          <ul className="divide-y divide-border">
            {PENDING.map((e, i) => (
              <li key={e.id}>
                <button
                  type="button"
                  className={
                    'w-full text-left px-4 md:px-5 py-3.5 md:py-3 active:bg-surface-2 md:hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset transition-colors ' +
                    /* Active highlight only on desktop (mobile navigates away) */
                    (i === 0 ? 'md:bg-surface md:border-l-2 md:border-l-accent' : 'md:border-l-2 md:border-l-transparent')
                  }
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="h-9 w-9 md:h-8 md:w-8 rounded-md flex items-center justify-center text-white shrink-0"
                      style={{ background: EXPENSE_TYPE_COLOR[e.type] }}
                    >
                      {e.type === 'FUEL' ? <Fuel className="h-4 w-4" /> : e.type === 'REPAIR' ? <Wrench className="h-4 w-4" /> : <Receipt className="h-4 w-4" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-semibold text-text truncate">{EXPENSE_LABEL[e.type]} · {e.vehicle}</div>
                        <div className="text-sm font-bold text-text tabular shrink-0">{e.amountFmt}</div>
                      </div>
                      <div className="text-xs text-text-faint truncate mt-0.5">{e.driver} · {e.when}</div>
                      {e.thresholdExceeded && (
                        <div className="mt-2 inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-warning bg-warning-soft px-1.5 py-0.5 rounded">
                          Threshold exceeded
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Detail pane — hidden on mobile (would compete with list). */}
        <section className="hidden md:block overflow-y-auto p-6 bg-bg">
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-xs text-text-muted tabular">EXP-{selected.id.slice(2).toUpperCase()}</div>
                <h2 className="text-xl font-semibold text-text mt-0.5">{EXPENSE_LABEL[selected.type]} · {selected.vehicle}</h2>
                <p className="mt-1 text-sm text-text-muted">Submitted by <span className="font-medium text-text">{selected.driver}</span> · {selected.when}</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-text-muted">Amount</div>
                <div className="text-3xl font-bold text-text tabular leading-none mt-1">{selected.amountFmt}</div>
              </div>
            </div>

            <Card>
              <CardContent>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  <DField label="Type" value={EXPENSE_LABEL[selected.type]} />
                  <DField label="Linked trip" value={selected.trip ?? '—'} />
                  <DField label="Vehicle" value={selected.vehicle} mono />
                  <DField label="Driver" value={selected.driver} />
                  <DField label="Auto-approve threshold" value="1,000,000₫" />
                  <DField label="Status" value={<Badge tone="warning" size="sm">Pending</Badge>} />
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardHeaderText>
                  <CardTitle>Receipt</CardTitle>
                </CardHeaderText>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div className="aspect-[3/4] rounded border border-border bg-surface-2 flex items-center justify-center text-text-faint text-xs">
                    <Receipt className="h-6 w-6" />
                  </div>
                  <div className="aspect-[3/4] rounded border border-border bg-surface-2 flex items-center justify-center text-text-faint text-xs">
                    + Receipt 2
                  </div>
                </div>
                <p className="mt-3 text-xs text-text-faint">Attachments stored in S3 (NFR-11). Click to enlarge.</p>
              </CardContent>
            </Card>

            <div className="sticky bottom-0 -mx-6 px-6 py-4 bg-bg/90 backdrop-blur border-t border-border">
              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" size="lg">Request changes</Button>
                <Button variant="danger" size="lg" iconLeft={<X />}>{tA('reject')}</Button>
                <Button variant="accent" size="lg" iconLeft={<Check />}>{tA('approve')}</Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function DField({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium text-text-muted mb-1">{label}</dt>
      <dd className={mono ? 'font-mono tabular text-text font-medium' : 'text-text font-medium'}>{value}</dd>
    </div>
  );
}
