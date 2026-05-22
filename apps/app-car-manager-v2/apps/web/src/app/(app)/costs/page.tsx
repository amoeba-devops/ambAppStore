import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Download, Fuel, Plus, Receipt, Wrench } from 'lucide-react';
import { Button, chartColors } from '@car-v2/ui';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import {
  listEntityExpenses,
  type EntityExpenseListItem,
} from '@/server/queries/expenses.queries';
import { ExpenseReviewPanel } from './_components/expense-review-panel';

type ExpenseType = EntityExpenseListItem['expType'];

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

const VND_FMT = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

function formatVnd(amount: string | number): string {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  return `${VND_FMT.format(n)}₫`;
}

function formatRelative(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  const hr = Math.floor(diffMin / 60);
  if (hr < 24) return `${hr} giờ trước`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'Hôm qua';
  if (day < 7) return `${day} ngày trước`;
  return d.toLocaleDateString('vi-VN');
}

interface PageProps {
  searchParams: Promise<{ selected?: string }>;
}

/* Operating-cost ledger for Admin / Manager.
 *
 * The approval queue (pending/approved/rejected tabs + approve/reject panel)
 * was removed when PRD §6.2.2 was revised — every expense is recorded as-is
 * and lands AUTO_APPROVED. This page is now purely a chronological ledger:
 *   - Left rail: every expense the entity has recorded, newest first
 *   - Right panel: full detail of the selected row (read-only)
 *   - Header CTAs: "+ Ghi nhận chi phí" (jumps to the shared submit form
 *                  pre-wired for Admin/Manager mode) + CSV export
 *
 * Drivers redirect to /today — the per-driver history at /expenses is for
 * them. */
export default async function CostsPage({ searchParams }: PageProps) {
  const actor = await getCurrentUser();
  if (actor.role === 'DRIVER') {
    redirect('/today');
  }

  const sp = await searchParams;

  const tA      = await getTranslations('actions');
  const tNav    = await getTranslations('nav');
  const tCo     = await getTranslations('company');
  const t       = await getTranslations('costs');
  const tType   = await getTranslations('costs.types');

  const items = await listEntityExpenses(actor.entId);
  const selected = items.find((e) => e.expId === sp.selected) ?? items[0] ?? null;

  return (
    <>
      <PageHeader
        title={t('approvalTitle')}
        subtitle={t('ledgerSubtitle', { count: items.length })}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('costs') }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="md" iconLeft={<Download />} asChild>
              <a href="/api/v1/expenses/export" download>{tA('export')}</a>
            </Button>
            <Button variant="accent" size="md" iconLeft={<Plus />} asChild>
              <Link href="/expenses/new">{t('recordExpense')}</Link>
            </Button>
          </div>
        }
        mobileAction={
          <Button variant="accent" size="sm" iconLeft={<Plus />} asChild>
            <Link href="/expenses/new" aria-label={t('recordExpense')}>
              <span className="sr-only md:not-sr-only">{t('recordExpense')}</span>
            </Link>
          </Button>
        }
      />

      <div className="flex-1 overflow-hidden flex flex-col md:grid md:grid-cols-[420px_1fr]">
        <aside className="md:border-r border-border bg-bg overflow-y-auto flex-1 md:flex-initial">
          <div className="px-4 md:px-5 py-3 border-b border-border bg-surface/70 backdrop-blur sticky top-0 z-10">
            <div className="text-sm font-semibold text-text">
              {t('countMatching', { count: items.length })}
            </div>
          </div>

          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-text-muted space-y-3">
              <p>{t('emptyLedger')}</p>
              <Button variant="accent" size="md" iconLeft={<Plus />} asChild>
                <Link href="/expenses/new">{t('recordExpense')}</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((e) => {
                const vehicle = e.vehiclePlate ?? '—';
                const driver = e.driverName ?? '—';
                const isSelected = selected?.expId === e.expId;
                const href = `/costs?${new URLSearchParams({ selected: e.expId }).toString()}`;
                return (
                  <li key={e.expId}>
                    <Link
                      href={href}
                      scroll={false}
                      className={
                        'block w-full text-left px-4 md:px-5 py-3.5 md:py-3 active:bg-surface-2 md:hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset transition-colors ' +
                        (isSelected ? 'md:bg-surface md:border-l-2 md:border-l-accent' : 'md:border-l-2 md:border-l-transparent')
                      }
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className="h-9 w-9 md:h-8 md:w-8 rounded-md flex items-center justify-center text-white shrink-0"
                          style={{ background: EXPENSE_TYPE_COLOR[e.expType] }}
                        >
                          {e.expType === 'FUEL' ? <Fuel className="h-4 w-4" /> :
                           e.expType === 'REPAIR' ? <Wrench className="h-4 w-4" /> :
                           <Receipt className="h-4 w-4" />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-sm font-semibold text-text truncate">
                              {tType(e.expType)} · {vehicle}
                            </div>
                            <div className="text-sm font-bold text-text tabular shrink-0">
                              {formatVnd(e.expAmount)}
                            </div>
                          </div>
                          <div className="text-xs text-text-faint truncate mt-0.5">
                            {driver} · {formatRelative(e.expSubmittedAt)}
                          </div>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="hidden md:block overflow-y-auto p-6 bg-bg">
          {selected ? (
            <ExpenseReviewPanel
              expense={selected}
              labels={{
                fAmount: t('fAmount'),
                fType: t('fType'),
                fLinkedTrip: t('fLinkedTrip'),
                fVehicle: t('fVehicle'),
                fDriver: t('fDriver'),
                submittedBy: t('submittedBy'),
                receiptTitle: t('receiptTitle'),
                receipt2: t('receipt2'),
                receiptNote: t('receiptNote'),
                typeLabel: tType(selected.expType),
              }}
              typeLabel={tType(selected.expType)}
              formatVnd={formatVnd}
              formatRelative={formatRelative}
            />
          ) : (
            <div className="max-w-md mx-auto mt-12 text-center text-sm text-text-muted">
              <Receipt className="mx-auto h-10 w-10 text-text-faint mb-3" />
              <p>{t('emptyDetail')}</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
