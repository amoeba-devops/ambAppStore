import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus, Receipt } from 'lucide-react';
import { Button, Card, EmptyState } from '@car-v2/ui';
import { Fab } from '@/components/layout/fab';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getDriverByUserId } from '@/server/queries/drivers.queries';
import { getExpenseDetail, listExpensesForDriver } from '@/server/queries/expenses.queries';
import { getSignedGetUrl } from '@/lib/s3-client';
import type { AttachmentItem } from './[id]/_components/attachment-gallery';
import { ExpensesList } from './_components/expenses-list';
import { ExpensePeekDrawer } from './_components/expense-peek-drawer';

interface PageProps {
  searchParams: Promise<{ page?: string; peek?: string }>;
}

/* Driver expense history (`/expenses`).
 *
 * Read-only list of the current driver's submitted expenses. Admin approval
 * flow was removed per user-flow §3.2 — every expense lands AUTO_APPROVED, so
 * the status badge effectively reads as a uniform "approved" stamp.
 *
 * Soft-edit window (7 days, `exp_locked_until`) and detail / edit views are
 * future REQs — this page is read-only for v1. */
export default async function ExpensesPage({ searchParams }: PageProps) {
  const tCo  = await getTranslations('company');
  const tNav = await getTranslations('nav');
  const tA   = await getTranslations('actions');
  const tE   = await getTranslations('expenses.history');
  const user = await getCurrentUser();

  /* `/expenses` is the per-driver history. Admin/Manager have their own
   * entity-wide ledger at `/costs` with a richer two-pane layout — kick
   * them over there so this driver-shaped screen doesn't show them an
   * empty state and a confusing "Tạo chi phí" CTA that's already on
   * /costs. Drivers continue to land here normally. */
  if (user.role !== 'DRIVER') {
    redirect('/costs');
  }

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));

  /* Look up the driver record so we filter expenses to the current actor.
   * Non-DRIVER roles landing here see an empty state. */
  const driver = user.role === 'DRIVER'
    ? await getDriverByUserId(user.entId, user.userId)
    : null;
  const result = driver
    ? await listExpensesForDriver({ entId: user.entId, driverId: driver.drvId, page, pageSize: 20 })
    : { items: [], total: 0, page: 1, pageSize: 20 };
  const items = result.items;
  const { total, pageSize } = result;

  /* Peek target — full detail + signed receipt URLs for the slide-over drawer. */
  const peekDetail = sp.peek ? await getExpenseDetail(user.entId, sp.peek) : null;
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

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(total, page * pageSize);

  return (
    <>
      <PageHeader
        title={tE('title')}
        subtitle={tE('subtitle', { count: total })}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('expensesNew') }]}
        back={user.role === 'DRIVER' ? '/today' : undefined}
        actions={
          <Button variant="accent" size="md" asChild>
            <Link href="/expenses/new"><Plus />{tE('newExpense')}</Link>
          </Button>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 max-w-3xl mx-auto w-full space-y-4">
        {items.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Receipt />}
              title={tE('emptyTitle')}
              description={user.role === 'DRIVER' ? tE('emptyDriverDesc') : tE('emptyOtherDesc')}
              action={
                user.role === 'DRIVER' ? (
                  <Button variant="accent" size="md" asChild>
                    <Link href="/expenses/new"><Plus />{tE('newExpense')}</Link>
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <>
            <ExpensesList items={items} page={page} />
            {totalPages > 1 && (
              <div className="flex flex-col-reverse md:flex-row md:items-center md:justify-between gap-3 text-sm text-text-muted">
                <span className="text-xs md:text-sm">
                  {tE('showing')}{' '}
                  <span className="font-semibold text-text tabular">{showingFrom}–{showingTo}</span>{' '}
                  {tE('of')}{' '}
                  <span className="font-semibold text-text tabular">{total}</span>
                </span>
                <div className="inline-flex items-center gap-1 self-end md:self-auto">
                  {page > 1 ? (
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={page - 1 > 1 ? `/expenses?page=${page - 1}` : '/expenses'}>{tE('previous')}</Link>
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" disabled>{tE('previous')}</Button>
                  )}
                  <span className="px-3 text-sm tabular">{page} / {totalPages}</span>
                  {page < totalPages ? (
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/expenses?page=${page + 1}`}>{tE('next')}</Link>
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" disabled>{tE('next')}</Button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Fab href="/expenses/new" label={tA('new')} icon={<Plus />} />

      {peekDetail && <ExpensePeekDrawer expense={peekDetail} attachments={peekAttachments} />}
    </>
  );
}
