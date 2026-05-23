'use client';

import { FileText, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardHeaderText, CardTitle, cn } from '@car-v2/ui';
import type { EntityExpenseListItem } from '@/server/queries/expenses.queries';
import {
  AttachmentGallery,
  type AttachmentItem,
} from '../../expenses/[id]/_components/attachment-gallery';

interface ExpenseDetailPanelProps {
  expense: EntityExpenseListItem;
  /** Pre-signed receipt attachments. Empty array → gallery renders its
   * own "no receipts" empty state. Parent server page signs each URL. */
  attachments: AttachmentItem[];
  labels: {
    fAmount: string;
    fType: string;
    fLinkedTrip: string;
    fVehicle: string;
    fDriver: string;
    fSource: string;
    sourceDriver: string;
    sourceStaff: string;
    submittedBy: string;
    receiptTitle: string;
  };
  typeLabel: string;
  /* Pre-formatted strings instead of formatter functions — Next.js 15
   * Server Components can't pass plain functions to Client Components
   * (no implicit serialisation; would throw "Functions cannot be passed
   * directly to Client Components"). The parent server page calls its
   * `formatVnd` / `formatRelative` helpers once and hands us the result. */
  amountFormatted: string;
  submittedAtFormatted: string;
}

/* Read-only expense detail. The approval flow (approve / reject buttons +
 * rejection-reason input + status toggle) was removed when PRD §6.2.2 was
 * revised — every expense lands AUTO_APPROVED and the panel just shows the
 * recorded values now. Kept as a component (instead of inlining in the
 * page) so the same shape can be reused if a "view full detail" route is
 * added later. */
export function ExpenseReviewPanel({
  expense,
  attachments,
  labels,
  typeLabel,
  amountFormatted,
  submittedAtFormatted,
}: ExpenseDetailPanelProps) {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-mono text-xs text-text-muted tabular">
              EXP-{expense.expId.slice(0, 8).toUpperCase()}
            </div>
            <SourcePill
              role={expense.submitterRole}
              label={expense.submitterRole === 'DRIVER' ? labels.sourceDriver : labels.sourceStaff}
            />
          </div>
          <h2 className="text-xl font-semibold text-text mt-0.5">
            {typeLabel} · {expense.vehiclePlate ?? '—'}
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            {labels.submittedBy}{' '}
            <span className="font-medium text-text">
              {expense.submitterName ?? expense.driverName ?? '—'}
            </span>{' '}
            · {submittedAtFormatted}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-text-muted">{labels.fAmount}</div>
          <div className="text-3xl font-bold text-text tabular leading-none mt-1">
            {amountFormatted}
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
            <DField
              label={labels.fSource}
              value={expense.submitterRole === 'DRIVER' ? labels.sourceDriver : labels.sourceStaff}
            />
          </dl>
          {expense.expNote && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="text-xs font-medium text-text-muted mb-1">Ghi chú</div>
              <div className="text-sm text-text whitespace-pre-wrap">{expense.expNote}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Receipts — same client gallery as the mobile /expenses/[id]
       * detail so desktop and mobile share one visual language. Tap a
       * thumbnail → fullscreen lightbox with prev/next + download. */}
      <Card>
        <CardHeader>
          <CardHeaderText>
            <CardTitle>{labels.receiptTitle}</CardTitle>
          </CardHeaderText>
        </CardHeader>
        <CardContent>
          <AttachmentGallery attachments={attachments} />
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

/* Slightly more prominent source pill for the detail panel header — matches
 * the inline badge in the /costs list rail but sized for the top-of-card
 * EXP-XXXX line. Driver-submitted rows get the accent tone; admin / manager
 * entries (back-office invoice) get a neutral surface tone. */
function SourcePill({
  role,
  label,
}: {
  role: EntityExpenseListItem['submitterRole'];
  label: string;
}) {
  const isDriver = role === 'DRIVER';
  const Icon = isDriver ? User : FileText;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide',
        isDriver
          ? 'bg-accent-soft text-accent'
          : 'bg-surface-2 text-text-muted',
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      <span>{label}</span>
    </span>
  );
}
