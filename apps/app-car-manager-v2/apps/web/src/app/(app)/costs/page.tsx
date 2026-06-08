import { getTranslations, getLocale } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Download, FileText, Fuel, Plus, Receipt, User, Wrench } from 'lucide-react';
import { Button, chartColors, cn } from '@car-v2/ui';
import { Fab } from '@/components/layout/fab';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getSignedGetUrl } from '@/lib/s3-client';
import {
  getExpenseDetail,
  listEntityExpenses,
  type EntityExpenseListItem,
} from '@/server/queries/expenses.queries';
import type { AttachmentItem } from '../expenses/[id]/_components/attachment-gallery';
import { ExpensePeekDrawer } from '../expenses/_components/expense-peek-drawer';
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

type RelativeT = (key: string, vars?: Record<string, string | number>) => string;

function formatRelative(date: Date | string, t: RelativeT, locale: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (diffMin < 1) return t('justNow');
  if (diffMin < 60) return t('minutesAgo', { n: diffMin });
  const hr = Math.floor(diffMin / 60);
  if (hr < 24) return t('hoursAgo', { n: hr });
  const day = Math.floor(hr / 24);
  if (day === 1) return t('yesterday');
  if (day < 7) return t('daysAgo', { n: day });
  const bcp = locale === 'ko' ? 'ko-KR' : locale === 'en' ? 'en-US' : 'vi-VN';
  return d.toLocaleDateString(bcp);
}

interface PageProps {
  searchParams: Promise<{ selected?: string; peek?: string }>;
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
  const tRel    = await getTranslations('users.relativeTime');
  const locale  = await getLocale();

  const items = await listEntityExpenses(actor.entId);
  const selected = items.find((e) => e.expId === sp.selected) ?? items[0] ?? null;

  /* When a row is selected, load full attachments + sign GET URLs so the
   * right-panel can show real receipts instead of the placeholder boxes
   * the panel originally rendered. Single detail fetch per page render
   * (only the visible selection); list rail itself doesn't need this. */
  let selectedAttachments: AttachmentItem[] = [];
  if (selected) {
    const detail = await getExpenseDetail(actor.entId, selected.expId);
    if (detail) {
      selectedAttachments = await Promise.all(
        detail.attachments.map(async (a) => ({
          eatId: a.eatId,
          eatMime: a.eatMime,
          eatSizeBytes: a.eatSizeBytes,
          signedUrl: await getSignedGetUrl(a.eatS3Key, 900),
        })),
      );
    }
  }

  /* Mobile peek drawer target (`?peek=`). Desktop keeps its in-place right
   * panel via `?selected=`; mobile (no right rail) opens the slide-over. */
  const peekDetail = sp.peek ? await getExpenseDetail(actor.entId, sp.peek) : null;
  let peekAttachments: AttachmentItem[] = [];
  if (peekDetail) {
    peekAttachments = await Promise.all(
      peekDetail.attachments.map(async (a) => ({
        eatId: a.eatId,
        eatMime: a.eatMime,
        eatSizeBytes: a.eatSizeBytes,
        signedUrl: await getSignedGetUrl(a.eatS3Key, 900),
      })),
    );
  }

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
        /* No mobileAction — the "+ Ghi nhận chi phí" CTA is rendered as the
         * floating action button at the bottom of the viewport instead.
         * Keeps the mobile header free for breadcrumbs + Me avatar. */
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
                /* Two link targets per row — desktop opens the inline
                 * right-rail panel via `?selected=…` (no full reload, the
                 * page re-renders the panel server-side), mobile pushes
                 * the full-screen `/expenses/[id]` detail page since the
                 * right rail is hidden on `< md`. Render both and gate
                 * with `md:hidden` / `hidden md:block` so the user only
                 * ever sees + taps one. */
                const desktopHref = `/costs?${new URLSearchParams({ selected: e.expId }).toString()}`;
                const mobileHref = `/costs?${new URLSearchParams({ peek: e.expId }).toString()}`;
                /* Shared row body, extracted so both anchors stay in sync. */
                const rowBody = (
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
                      <div className="text-xs text-text-faint truncate mt-0.5 flex items-center gap-1.5">
                        <SourceBadge role={e.submitterRole} label={t(e.submitterRole === 'DRIVER' ? 'sourceDriver' : 'sourceStaff')} />
                        <span>·</span>
                        <span className="truncate">{driver}</span>
                        <span>·</span>
                        <span className="whitespace-nowrap">{formatRelative(e.expSubmittedAt, tRel, locale)}</span>
                      </div>
                    </div>
                  </div>
                );
                const rowClass = cn(
                  'block w-full text-left px-4 md:px-5 py-3.5 md:py-3 active:bg-surface-2 md:hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset transition-colors',
                  isSelected ? 'md:bg-surface md:border-l-2 md:border-l-accent' : 'md:border-l-2 md:border-l-transparent',
                );
                return (
                  <li key={e.expId}>
                    {/* Mobile: slide-over peek drawer (right rail is hidden < md). */}
                    <Link href={mobileHref} scroll={false} className={cn(rowClass, 'md:hidden')}>
                      {rowBody}
                    </Link>
                    {/* Desktop: select-in-place, panel updates beside. */}
                    <Link href={desktopHref} scroll={false} className={cn(rowClass, 'hidden md:block')}>
                      {rowBody}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="hidden md:block overflow-y-auto p-6 bg-bg">
          {selected ? (
            /* Pre-format the dynamic values on the server — Next 15's
             * server→client boundary refuses raw functions, so we pass
             * already-rendered strings. The detail panel is a snapshot
             * (read-only), so "rendered once at request time" is fine —
             * a "2 phút trước" that ages to "3 phút trước" on slow
             * navigation isn't worth the cost of a live timer. */
            <ExpenseReviewPanel
              expense={selected}
              attachments={selectedAttachments}
              labels={{
                fAmount: t('fAmount'),
                fType: t('fType'),
                fLinkedTrip: t('fLinkedTrip'),
                fVehicle: t('fVehicle'),
                fDriver: t('fDriver'),
                fSource: t('fSource'),
                sourceDriver: t('sourceDriver'),
                sourceStaff: t('sourceStaff'),
                submittedBy: t('submittedBy'),
                receiptTitle: t('receiptTitle'),
                notesLabel: t('notesLabel'),
                tripDeleted: t('tripDeleted'),
                driverDeleted: t('driverDeleted'),
                vehicleDeleted: t('vehicleDeleted'),
              }}
              typeLabel={tType(selected.expType)}
              amountFormatted={formatVnd(selected.expAmount)}
              submittedAtFormatted={formatRelative(selected.expSubmittedAt, tRel, locale)}
            />
          ) : (
            <div className="max-w-md mx-auto mt-12 text-center text-sm text-text-muted">
              <Receipt className="mx-auto h-10 w-10 text-text-faint mb-3" />
              <p>{t('emptyDetail')}</p>
            </div>
          )}
        </section>
      </div>

      {/* PWA-style FAB for the primary action — bottom-right, mobile-only.
       * Desktop carries the same CTA in the PageHeader actions; this is
       * the touch-friendly mirror that's reachable without a header tap. */}
      <Fab href="/expenses/new" label={t('recordExpense')} icon={<Plus />} />

      {peekDetail && <ExpensePeekDrawer expense={peekDetail} attachments={peekAttachments} />}
    </>
  );
}

/* Inline pill that tags each expense row with its source — driver
 * field-submit vs admin/manager back-office entry. Visual difference is
 * deliberately quiet (no border, muted background) so it sits in the
 * row's secondary metadata line without competing with the type icon
 * or amount. */
function SourceBadge({
  role,
  label,
}: {
  role: 'ADMIN' | 'MANAGER' | 'DRIVER' | null;
  label: string;
}) {
  const isDriver = role === 'DRIVER';
  const Icon = isDriver ? User : FileText;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded px-1 py-px text-[10px] font-semibold uppercase tracking-wide shrink-0',
        isDriver
          ? 'bg-accent-soft text-accent'
          : 'bg-surface-2 text-text-muted',
      )}
      title={label}
    >
      <Icon className="h-2.5 w-2.5" aria-hidden />
      <span>{label}</span>
    </span>
  );
}
