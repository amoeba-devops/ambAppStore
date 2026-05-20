import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Plus, Receipt } from 'lucide-react';
import { Button, Card, EmptyState } from '@car-v2/ui';
import { Fab } from '@/components/layout/fab';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getDriverByUserId } from '@/server/queries/drivers.queries';
import { listExpensesForDriver } from '@/server/queries/expenses.queries';
import { ExpensesList } from './_components/expenses-list';

/* Driver expense history (`/expenses`).
 *
 * Admin/manager already have `/costs` (approval queue). Drivers needed a
 * counterpart to see what they've submitted + the current approval state
 * (PENDING / APPROVED / REJECTED / AUTO_APPROVED).
 *
 * Soft-edit window (7 days, `exp_locked_until`) and detail / edit views are
 * future REQs — this page is read-only for v1. */
export default async function ExpensesPage() {
  const tCo  = await getTranslations('company');
  const tNav = await getTranslations('nav');
  const tA   = await getTranslations('actions');
  const tE   = await getTranslations('expenses.history');
  const user = await getCurrentUser();

  /* Look up the driver record so we filter expenses to the current actor.
   * Non-DRIVER roles landing here see an empty state — they should use
   * `/costs` (admin approval queue) instead. */
  const driver = user.role === 'DRIVER'
    ? await getDriverByUserId(user.entId, user.userId)
    : null;
  const items = driver
    ? await listExpensesForDriver({ entId: user.entId, driverId: driver.drvId })
    : [];

  return (
    <>
      <PageHeader
        title={tE('title')}
        subtitle={tE('subtitle', { count: items.length })}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('expensesNew') }]}
        back={user.role === 'DRIVER' ? '/today' : undefined}
        actions={
          <Button variant="accent" size="md" asChild>
            <Link href="/expenses/new"><Plus />{tE('newExpense')}</Link>
          </Button>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 max-w-3xl mx-auto w-full">
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
          <ExpensesList items={items} />
        )}
      </div>

      <Fab href="/expenses/new" label={tA('new')} icon={<Plus />} />
    </>
  );
}
