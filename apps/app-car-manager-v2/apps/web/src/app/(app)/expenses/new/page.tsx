import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@car-v2/ui';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { ExpenseSubmitForm } from './_components/expense-submit-form';

interface ExpenseNewPageProps {
  searchParams: Promise<{ tripId?: string }>;
}

/* Driver-facing expense submit screen. Reached via:
 *   - `/today` FAB → unscoped or `?tripId=<currentTrip>` when there is one
 *   - Trip detail "Record expense" (future entry — not in this PR)
 *
 * Backend P2 isn't wired (see `expense.actions.ts` STUB note); we still render
 * the screen and exercise the form so we can demo / test the UX. The stub
 * banner inside the form makes the test-mode state explicit to QA.
 *
 * Uses the same `<PageHeader>` as every other page so the chrome reads
 * identically across roles — user feedback was that a driver-specific compact
 * header broke design-system consistency. */
export default async function ExpenseNewPage({ searchParams }: ExpenseNewPageProps) {
  const tA   = await getTranslations('actions');
  const tCo  = await getTranslations('company');
  const tNav = await getTranslations('nav');
  const tE   = await getTranslations('expenses.submit');

  await getCurrentUser(); // assert auth + 401 if missing
  const { tripId } = await searchParams;

  return (
    <>
      <PageHeader
        title={tE('title')}
        subtitle={tE('subtitle')}
        breadcrumbs={[
          { label: tCo('tenant') },
          { label: tNav('today'), href: '/today' },
          { label: tE('title') },
        ]}
        back="/today"
        actions={
          <Button variant="ghost" size="md" asChild>
            <Link href="/today"><ChevronLeft />{tA('back')}</Link>
          </Button>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6">
        <ExpenseSubmitForm tripId={tripId} />
      </div>
    </>
  );
}
