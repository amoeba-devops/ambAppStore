'use client';

import { Receipt } from 'lucide-react';
import { Card, CardContent, CardHeader, CardHeaderText, CardTitle } from '@car-v2/ui';
import type { EntityExpenseListItem } from '@/server/queries/expenses.queries';

interface ExpenseDetailPanelProps {
  expense: EntityExpenseListItem;
  labels: {
    fAmount: string;
    fType: string;
    fLinkedTrip: string;
    fVehicle: string;
    fDriver: string;
    submittedBy: string;
    receiptTitle: string;
    receipt2: string;
    receiptNote: string;
    typeLabel: string;
  };
  typeLabel: string;
  formatVnd: (v: string) => string;
  formatRelative: (d: Date | string) => string;
}

/* Read-only expense detail. The approval flow (approve / reject buttons +
 * rejection-reason input + status toggle) was removed when PRD §6.2.2 was
 * revised — every expense lands AUTO_APPROVED and the panel just shows the
 * recorded values now. Kept as a component (instead of inlining in the
 * page) so the same shape can be reused if a "view full detail" route is
 * added later. */
export function ExpenseReviewPanel({
  expense,
  labels,
  typeLabel,
  formatVnd,
  formatRelative,
}: ExpenseDetailPanelProps) {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-xs text-text-muted tabular">
            EXP-{expense.expId.slice(0, 8).toUpperCase()}
          </div>
          <h2 className="text-xl font-semibold text-text mt-0.5">
            {typeLabel} · {expense.vehiclePlate ?? '—'}
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            {labels.submittedBy}{' '}
            <span className="font-medium text-text">
              {expense.driverName ?? '—'}
            </span>{' '}
            · {formatRelative(expense.expSubmittedAt)}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-text-muted">{labels.fAmount}</div>
          <div className="text-3xl font-bold text-text tabular leading-none mt-1">
            {formatVnd(expense.expAmount)}
          </div>
        </div>
      </div>

      <Card>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <DField label={labels.fType} value={typeLabel} />
            <DField label={labels.fLinkedTrip} value={expense.tripRef ?? '—'} />
            <DField label={labels.fVehicle} value={expense.vehiclePlate ?? '—'} mono />
            <DField label={labels.fDriver} value={expense.driverName ?? '—'} />
          </dl>
          {expense.expNote && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="text-xs font-medium text-text-muted mb-1">Ghi chú</div>
              <div className="text-sm text-text whitespace-pre-wrap">{expense.expNote}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardHeaderText>
            <CardTitle>{labels.receiptTitle}</CardTitle>
          </CardHeaderText>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div className="aspect-[3/4] rounded border border-border bg-surface-2 flex items-center justify-center text-text-faint text-xs">
              <Receipt className="h-6 w-6" />
            </div>
            <div className="aspect-[3/4] rounded border border-border bg-surface-2 flex items-center justify-center text-text-faint text-xs">
              {labels.receipt2}
            </div>
          </div>
          <p className="mt-3 text-xs text-text-faint">{labels.receiptNote}</p>
        </CardContent>
      </Card>
    </div>
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
