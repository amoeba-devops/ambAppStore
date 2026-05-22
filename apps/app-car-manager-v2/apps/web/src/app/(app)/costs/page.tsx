import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Download, Fuel, Receipt, Wrench } from 'lucide-react';
import {
  Badge,
  Button,
  chartColors,
} from '@car-v2/ui';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import {
  listPendingExpenses,
  type ExpenseStatusFilter,
  type PendingExpenseListItem,
} from '@/server/queries/expenses.queries';
import { ExpenseReviewPanel } from './_components/expense-review-panel';

type ExpenseType = PendingExpenseListItem['expType'];

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

/* Threshold mặc định cho cảnh báo "vượt ngưỡng" — sau này sẽ đọc từ
 * car_approval_rules per entity. MVP hardcode. */
const TYPE_THRESHOLD_VND: Partial<Record<ExpenseType, number>> = {
  FUEL: 1_000_000,
  REPAIR: 3_000_000,
  MEAL: 500_000,
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

function isThresholdExceeded(item: PendingExpenseListItem): boolean {
  const threshold = TYPE_THRESHOLD_VND[item.expType];
  if (!threshold) return false;
  return Number(item.expAmount) > threshold;
}

interface PageProps {
  searchParams: Promise<{ status?: string; selected?: string }>;
}

export default async function CostsPage({ searchParams }: PageProps) {
  const actor = await getCurrentUser();
  // RBAC: chỉ ADMIN/MANAGER thấy approval queue. Driver redirect /today.
  if (actor.role === 'DRIVER') {
    redirect('/today');
  }

  const sp = await searchParams;
  const statusFilter = ((['pending', 'approved', 'rejected', 'all'] as const).includes(
    sp.status as ExpenseStatusFilter,
  )
    ? sp.status
    : 'pending') as ExpenseStatusFilter;

  const tA      = await getTranslations('actions');
  const tNav    = await getTranslations('nav');
  const tCo     = await getTranslations('company');
  const t       = await getTranslations('costs');
  const tType   = await getTranslations('costs.types');

  const items = await listPendingExpenses(actor.entId, statusFilter);
  const selected =
    items.find((e) => e.expId === sp.selected) ?? items[0] ?? null;

  const TABS: Array<{ key: ExpenseStatusFilter; label: string }> = [
    { key: 'pending',  label: t('tabPending') },
    { key: 'approved', label: t('tabApproved') },
    { key: 'rejected', label: t('tabRejected') },
    { key: 'all',      label: t('tabAll') },
  ];

  /* Export URL ent-scoped — server route handler verify auth + filter theo ent_id. */
  const exportHref = (() => {
    const params = new URLSearchParams();
    if (statusFilter !== 'pending') params.set('status', statusFilter);
    const qs = params.toString();
    return qs ? `/api/v1/expenses/export?${qs}` : '/api/v1/expenses/export';
  })();

  return (
    <>
      <PageHeader
        title={t('approvalTitle')}
        subtitle={t('approvalSubtitle')}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('costs') }]}
        actions={
          <Button variant="ghost" size="md" iconLeft={<Download />} asChild>
            <a href={exportHref} download>{tA('export')}</a>
          </Button>
        }
      />

      <div className="flex-1 overflow-hidden flex flex-col md:grid md:grid-cols-[420px_1fr]">
        <aside className="md:border-r border-border bg-bg overflow-y-auto flex-1 md:flex-initial">
          {/* Tabs */}
          <div className="px-4 md:px-5 py-3 border-b border-border bg-surface/70 backdrop-blur sticky top-0 z-10 space-y-2.5">
            <div className="inline-flex items-center gap-1 rounded-md bg-surface-2 p-1 w-full md:w-auto overflow-x-auto">
              {TABS.map((tab) => {
                const active = statusFilter === tab.key;
                const href = tab.key === 'pending' ? '/costs' : `/costs?status=${tab.key}`;
                return (
                  <Link
                    key={tab.key}
                    href={href}
                    className={
                      'inline-flex items-center h-7 px-3 rounded text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
                      (active ? 'bg-surface text-text shadow-xs' : 'text-text-muted hover:text-text')
                    }
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-text">
                {statusFilter === 'pending'
                  ? t('pendingReview', { count: items.length })
                  : t('countMatching', { count: items.length })}
              </div>
              {statusFilter === 'pending' && items.length > 0 && (
                <Badge tone="warning" size="sm">{t('needsYou')}</Badge>
              )}
            </div>
          </div>

          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-text-muted">
              {statusFilter === 'pending'
                ? '✅ Không có chi phí nào đang chờ duyệt.'
                : 'Không có chi phí nào khớp bộ lọc.'}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((e) => {
                const thresholdExceeded = isThresholdExceeded(e);
                const vehicle = e.vehiclePlate ?? '—';
                const driver = e.driverName ?? 'Tài xế';
                const isSelected = selected?.expId === e.expId;
                const href = `/costs?${new URLSearchParams({
                  ...(statusFilter !== 'pending' ? { status: statusFilter } : {}),
                  selected: e.expId,
                }).toString()}`;
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
                          {e.expType === 'FUEL' ? <Fuel className="h-4 w-4" /> : e.expType === 'REPAIR' ? <Wrench className="h-4 w-4" /> : <Receipt className="h-4 w-4" />}
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
                          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                            <Badge
                              tone={
                                e.expStatus === 'PENDING' ? 'warning' :
                                e.expStatus === 'REJECTED' ? 'danger' :
                                'success'
                              }
                              size="sm"
                            >
                              {e.expStatus === 'PENDING' ? t('fPending') :
                               e.expStatus === 'REJECTED' ? t('fRejected') :
                               t('fApproved')}
                            </Badge>
                            {thresholdExceeded && (
                              <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-warning bg-warning-soft px-1.5 py-0.5 rounded">
                                {t('thresholdExceeded')}
                              </span>
                            )}
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
              /* ADMIN only review, theo PRD §6.2.2. Khi expense đã APPROVED/REJECTED → không review nữa. */
              canReview={actor.role === 'ADMIN' && selected.expStatus === 'PENDING'}
              labels={{
                fAmount: t('fAmount'),
                fType: t('fType'),
                fLinkedTrip: t('fLinkedTrip'),
                fVehicle: t('fVehicle'),
                fDriver: t('fDriver'),
                fStatus: t('fStatus'),
                fPending: t('fPending'),
                fApproved: t('fApproved'),
                fRejected: t('fRejected'),
                reviewNoteLabel: t('reviewNote'),
                submittedBy: t('submittedBy'),
                receiptTitle: t('receiptTitle'),
                receipt2: t('receipt2'),
                receiptNote: t('receiptNote'),
                rejectReasonPlaceholder: t('rejectReasonPlaceholder'),
                rejectReasonRequired: t('rejectReasonRequired'),
                approve: tA('approve'),
                reject: tA('reject'),
                approving: t('approving'),
                rejecting: t('rejecting'),
                approveSuccess: t('approveSuccess'),
                rejectSuccess: t('rejectSuccess'),
                typeLabel: tType(selected.expType),
              }}
              typeLabel={tType(selected.expType)}
              formatVnd={formatVnd}
              formatRelative={formatRelative}
              thresholdLabel={
                TYPE_THRESHOLD_VND[selected.expType]
                  ? formatVnd(TYPE_THRESHOLD_VND[selected.expType]!)
                  : '—'
              }
            />
          ) : (
            <div className="max-w-md mx-auto mt-12 text-center text-sm text-text-muted">
              <Receipt className="mx-auto h-10 w-10 text-text-faint mb-3" />
              <p>Chọn một chi phí ở bên trái để xem chi tiết.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
