import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Receipt } from 'lucide-react';
import { Badge, Card } from '@car-v2/ui';
import type { CarExpenseStatus } from '@car-v2/db/schema';
import type { DriverExpenseListItem } from '@/server/queries/expenses.queries';

interface ExpensesListProps {
  items: DriverExpenseListItem[];
  /** Current list page — preserved in the peek URL so closing the drawer
   * returns to the same page. */
  page?: number;
}

/* Read-only expense list for the driver.
 *
 * Each row shows: type icon, amount, occurred date, optional trip ref, status
 * pill. Tapping a row navigates to `/expenses/[id]` for full detail —
 * receipts, lock window, attachments, etc.
 *
 * Server component — receives data from the page RSC and renders. The
 * approval-status pill colour is the only signal that needs interpretation;
 * the rest is informational. */
export async function ExpensesList({ items, page = 1 }: ExpensesListProps) {
  const tType    = await getTranslations('costs.types');
  const tStatus  = await getTranslations('expenses.status');
  const peekHref = (expId: string) =>
    page > 1 ? `/expenses?page=${page}&peek=${expId}` : `/expenses?peek=${expId}`;

  return (
    <ul className="space-y-2">
      {items.map((exp) => {
        const amount = Number(exp.expAmount);
        const date = formatDate(exp.expOccurredAt);
        return (
          <li key={exp.expId}>
            <Link
              href={peekHref(exp.expId)}
              scroll={false}
              className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="p-4 transition-colors active:bg-surface-2 md:hover:bg-surface-2">
                <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-full bg-surface-2 text-text-muted flex items-center justify-center shrink-0" aria-hidden>
                  <Receipt className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-text truncate">{tType(exp.expType)}</div>
                      <div className="text-xs text-text-faint">
                        {date}
                        {exp.tripRef && (
                          <>
                            <span className="mx-1">·</span>
                            <span className="font-mono tabular">{exp.tripRef}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-md font-bold tabular text-text">{formatAmount(amount)}</div>
                      <Badge tone={STATUS_TONE[exp.expStatus]} size="md" className="font-semibold mt-1">
                        {tStatus(exp.expStatus)}
                      </Badge>
                    </div>
                  </div>
                  {exp.expNote && (
                    <p className="mt-2 text-xs text-text-muted leading-snug line-clamp-2">{exp.expNote}</p>
                  )}
                  {exp.expStatus === 'REJECTED' && exp.expReviewNote && (
                    <p className="mt-2 text-xs text-danger leading-snug">
                      <span className="font-semibold">↳</span> {exp.expReviewNote}
                    </p>
                  )}
                </div>
              </div>
              </Card>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function formatAmount(n: number): string {
  return `${n.toLocaleString('vi-VN')}₫`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

const STATUS_TONE: Record<CarExpenseStatus, 'warning' | 'success' | 'danger' | 'info'> = {
  PENDING:       'warning',
  APPROVED:      'success',
  AUTO_APPROVED: 'info',
  REJECTED:      'danger',
};
