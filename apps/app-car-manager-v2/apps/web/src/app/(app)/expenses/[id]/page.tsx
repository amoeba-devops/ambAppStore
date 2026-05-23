import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import {
  Calendar,
  ClipboardList,
  Clock,
  FileText,
  Fuel,
  Paperclip,
  Receipt,
  User as UserIcon,
  Wrench,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardHeaderText,
  CardTitle,
  chartColors,
  cn,
} from '@car-v2/ui';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getSignedGetUrl } from '@/lib/s3-client';
import { getExpenseDetail } from '@/server/queries/expenses.queries';
import { AttachmentGallery, type AttachmentItem } from './_components/attachment-gallery';

type ExpenseType =
  | 'FUEL'
  | 'REPAIR'
  | 'MEAL'
  | 'OIL'
  | 'ACCIDENT'
  | 'PARKING'
  | 'TOLL'
  | 'INSPECTION';

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

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(d: Date | string): string {
  return new Date(d).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/* Lock-window helper — how many days until the driver loses the soft-edit
 * window. Negative = already locked. Used only as a status hint here; the
 * /expenses/[id]/edit screen (future REQ) is what actually gates the edit
 * action against `expLockedUntil`. */
function daysUntilLock(lockedUntil: Date): number {
  return Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 86_400_000);
}

interface PageProps {
  params: Promise<{ id: string }>;
}

/* Dedicated expense detail page. Reached from:
 *   - /costs row tap on mobile (desktop opens the inline panel instead)
 *   - /expenses (driver history) tap on a row
 *   - Trip detail "Expenses" section (future)
 *   - Direct deep link from notifications
 *
 * Read-only — the soft-edit flow within the 7-day lock window is a
 * separate REQ. The page surfaces:
 *   - Type icon + amount hero
 *   - Source pill (driver-submit vs fleet invoice)
 *   - Vehicle / driver / trip / occurred-at fields
 *   - Note (if any)
 *   - Receipt attachments — count + metadata; image preview is a future
 *     iteration once the `s3-get` signed-URL helper lands.
 *   - Lock-window status hint */
export default async function ExpenseDetailPage({ params }: PageProps) {
  const { id } = await params;
  const tCo   = await getTranslations('company');
  const tNav  = await getTranslations('nav');
  const t     = await getTranslations('costs');
  const tType = await getTranslations('costs.types');
  const tE    = await getTranslations('expenses.detail');
  const user  = await getCurrentUser();

  const expense = await getExpenseDetail(user.entId, id);
  if (!expense) notFound();

  /* Pre-sign GET URLs for every attachment so the client gallery can render
   * inline previews without needing its own auth roundtrip. 15-min TTL covers
   * a user keeping the page open while flipping between receipts in the
   * lightbox; refresh on page reload picks up new URLs.
   *
   * Promise.all in parallel — typical expense has 1-5 attachments, signing
   * is in-process and fast, no benefit to sequential. */
  const signedAttachments: AttachmentItem[] = await Promise.all(
    expense.attachments.map(async (a) => ({
      eatId: a.eatId,
      eatMime: a.eatMime,
      eatSizeBytes: a.eatSizeBytes,
      signedUrl: await getSignedGetUrl(a.eatS3Key, 900),
    })),
  );

  /* Role-aware back target: staff bounces to the cost ledger (where they
   * came from), drivers bounce to their personal history. */
  const isStaff = user.role === 'ADMIN' || user.role === 'MANAGER';
  const backHref = isStaff ? '/costs' : '/expenses';
  const backLabel = isStaff ? tNav('costs') : tNav('expensesNew');

  const typeLabel = tType(expense.expType);
  const TypeIcon =
    expense.expType === 'FUEL' ? Fuel :
    expense.expType === 'REPAIR' ? Wrench :
    Receipt;
  const isDriverSubmit = expense.submitterRole === 'DRIVER';
  const SourceIcon = isDriverSubmit ? UserIcon : FileText;
  const lockDays = daysUntilLock(expense.expLockedUntil);
  const isLocked = lockDays <= 0;

  return (
    <>
      <PageHeader
        title={`${typeLabel} · ${expense.vehiclePlate ?? '—'}`}
        breadcrumbs={[
          { label: tCo('tenant') },
          { label: backLabel, href: backHref },
          { label: `EXP-${expense.expId.slice(0, 8).toUpperCase()}` },
        ]}
        back={backHref}
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 max-w-3xl mx-auto w-full space-y-5">
        {/* Hero: type icon + amount + source badge.
         *
         * On mobile the hero compresses to a single column so the giant
         * amount stays legible without competing with the icon. Desktop
         * runs them side-by-side for at-a-glance scanning. */}
        <Card>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start gap-5">
              <div
                className="h-16 w-16 rounded-lg flex items-center justify-center text-white shrink-0"
                style={{ background: EXPENSE_TYPE_COLOR[expense.expType] }}
                aria-hidden
              >
                <TypeIcon className="h-7 w-7" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-text-muted tabular">
                    EXP-{expense.expId.slice(0, 8).toUpperCase()}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide',
                      isDriverSubmit
                        ? 'bg-accent-soft text-accent'
                        : 'bg-surface-2 text-text-muted',
                    )}
                  >
                    <SourceIcon className="h-3 w-3" aria-hidden />
                    {isDriverSubmit ? t('sourceDriver') : t('sourceStaff')}
                  </span>
                </div>
                <h2 className="mt-1 text-xl font-semibold text-text leading-tight">
                  {typeLabel} · {expense.vehiclePlate ?? '—'}
                </h2>
                <div className="mt-3 text-3xl font-bold text-text tabular leading-none">
                  {formatVnd(expense.expAmount)}
                </div>
                <div className="mt-1.5 text-xs text-text-muted">
                  {expense.expCurrency}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fact grid — every recorded field, two-column on phone+. */}
        <Card>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <DField icon={<Calendar className="h-3.5 w-3.5" />} label={tE('occurredAt')} value={formatDate(expense.expOccurredAt)} />
              <DField icon={<Clock className="h-3.5 w-3.5" />} label={tE('submittedAt')} value={formatDateTime(expense.expSubmittedAt)} />
              <DField icon={<UserIcon className="h-3.5 w-3.5" />} label={t('fDriver')} value={expense.driverName ?? '—'} />
              <DField icon={<UserIcon className="h-3.5 w-3.5" />} label={t('submittedBy')} value={expense.submitterName ?? '—'} />
              <DField
                icon={<ClipboardList className="h-3.5 w-3.5" />}
                label={t('fLinkedTrip')}
                value={expense.tripRef ?? '—'}
                mono
              />
              <DField
                icon={<Receipt className="h-3.5 w-3.5" />}
                label={t('fVehicle')}
                value={expense.vehiclePlate ?? '—'}
                mono
              />
            </dl>
            {expense.expNote && (
              <div className="mt-5 pt-5 border-t border-border">
                <div className="text-xs font-medium text-text-muted mb-1.5">{tE('noteLabel')}</div>
                <div className="text-sm text-text whitespace-pre-wrap leading-relaxed">{expense.expNote}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Receipts gallery — inline thumbnail grid that opens a fullscreen
         * lightbox on tap. Signed URLs are pre-generated server-side (see
         * `signedAttachments` above). The gallery handles its own empty
         * state so this card stays the same shape whether the expense has
         * attachments or not. */}
        <Card>
          <CardHeader>
            <CardHeaderText>
              <CardTitle>
                <span className="inline-flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-text-muted" aria-hidden />
                  {tE('attachmentsTitle', { count: signedAttachments.length })}
                </span>
              </CardTitle>
            </CardHeaderText>
          </CardHeader>
          <CardContent>
            <AttachmentGallery attachments={signedAttachments} />
          </CardContent>
        </Card>

      </div>
    </>
  );
}

function DField({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-text-muted mb-1 inline-flex items-center gap-1.5">
        <span className="text-text-faint" aria-hidden>{icon}</span>
        {label}
      </dt>
      <dd className={cn('truncate', mono ? 'font-mono tabular text-text font-medium' : 'text-text font-medium')}>
        {value}
      </dd>
    </div>
  );
}
