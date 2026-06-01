'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowUpRight,
  Calendar,
  Clock,
  FileText,
  Fuel,
  Receipt,
  User as UserIcon,
  Wrench,
} from 'lucide-react';
import { Button, Card, CardContent, chartColors, cn } from '@car-v2/ui';
import { Sheet, SheetCloseButton } from '@/components/layout/sheet';
import type { ExpenseDetail } from '@/server/queries/expenses.queries';
import { AttachmentGallery, type AttachmentItem } from '../[id]/_components/attachment-gallery';

const TYPE_COLOR: Record<ExpenseDetail['expType'], string> = {
  FUEL: chartColors[0],
  REPAIR: chartColors[1],
  MEAL: chartColors[2],
  OIL: chartColors[3],
  ACCIDENT: chartColors[4],
  PARKING: chartColors[5],
  TOLL: chartColors[6],
  INSPECTION: chartColors[7],
};

interface ExpensePeekDrawerProps {
  expense: ExpenseDetail;
  attachments: AttachmentItem[];
}

/**
 * Slide-over drawer for an expense — opens when `?peek={expId}` is in the URL.
 * Mounted on both /expenses (driver history) and /costs (admin ledger). Mirrors
 * the /expenses/[id] full-page detail, condensed for the panel; the footer's
 * "open full" link routes to the full page for deep work.
 *
 * Mobile-first: full-width on phones (Sheet default), single-column fact grid
 * on the narrowest viewport, full-width footer action.
 */
export function ExpensePeekDrawer({ expense, attachments }: ExpensePeekDrawerProps) {
  const t = useTranslations('costs');
  const tType = useTranslations('costs.types');
  const tE = useTranslations('expenses.detail');
  const tPeek = useTranslations('expenses.peek');
  const locale = useLocale();
  const bcp = locale === 'ko' ? 'ko-KR' : locale === 'en' ? 'en-US' : 'vi-VN';

  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const basePath = pathname ?? '/expenses';
  const closeUrl = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('peek');
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const handleClose = (open: boolean) => {
    if (open) return;
    router.replace(closeUrl(), { scroll: false });
  };

  const ref = `EXP-${expense.expId.slice(0, 8).toUpperCase()}`;
  const amount = `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(expense.expAmount))}₫`;
  const isDriver = expense.submitterRole === 'DRIVER';
  const TypeIcon = expense.expType === 'FUEL' ? Fuel : expense.expType === 'REPAIR' ? Wrench : Receipt;
  const SourceIcon = isDriver ? UserIcon : FileText;
  const occurredAt = new Date(expense.expOccurredAt).toLocaleDateString(bcp, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const submittedAt = new Date(expense.expSubmittedAt).toLocaleString(bcp, { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <Sheet
      open
      onOpenChange={handleClose}
      title={tPeek('a11yTitle', { ref })}
      description={tPeek('a11yDescription')}
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-border bg-bg px-5 py-3.5">
        <span className="font-mono text-base font-bold tabular text-text">{ref}</span>
        <SheetCloseButton label={tPeek('close')} />
      </header>

      {/* Body */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {/* Hero — type icon + amount + source pill */}
        <div className="flex items-start gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-white"
            style={{ background: TYPE_COLOR[expense.expType] }}
            aria-hidden
          >
            <TypeIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide',
                isDriver ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-text-muted',
              )}
            >
              <SourceIcon className="h-3 w-3" aria-hidden />
              {isDriver ? t('sourceDriver') : t('sourceStaff')}
            </span>
            <h2 className="mt-1 text-lg font-semibold leading-tight text-text">
              {tType(expense.expType)} · {expense.vehiclePlate ?? '—'}
            </h2>
            <div className="mt-1.5 text-2xl font-bold tabular leading-none text-text">{amount}</div>
          </div>
        </div>

        {/* Fact grid */}
        <Card>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3.5 text-sm sm:grid-cols-2">
              <Field icon={<Calendar />} label={tE('occurredAt')} value={occurredAt} />
              <Field icon={<Clock />} label={tE('submittedAt')} value={submittedAt} />
              <Field icon={<UserIcon />} label={t('fDriver')} value={expense.driverName ?? '—'} />
              <Field icon={<UserIcon />} label={t('submittedBy')} value={expense.submitterName ?? '—'} />
              <Field icon={<Receipt />} label={t('fLinkedTrip')} value={expense.tripRef ?? '—'} mono />
              <Field icon={<Receipt />} label={t('fVehicle')} value={expense.vehiclePlate ?? '—'} mono />
            </dl>
            {expense.expNote && (
              <div className="mt-4 border-t border-border pt-4">
                <div className="mb-1 text-xs font-medium text-text-muted">{tE('noteLabel')}</div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-text">{expense.expNote}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Receipts */}
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-faint">
            {tE('attachmentsTitle', { count: attachments.length })}
          </div>
          <AttachmentGallery attachments={attachments} />
        </div>
      </div>

      {/* Footer — full-width open-full action */}
      <footer className="border-t border-border bg-bg px-5 py-3">
        <Button asChild variant="ghost" size="lg" className="w-full" iconRight={<ArrowUpRight />}>
          <Link href={`/expenses/${expense.expId}`}>{tPeek('openFull')}</Link>
        </Button>
      </footer>
    </Sheet>
  );
}

function Field({
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
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-text-faint [&_svg]:h-3.5 [&_svg]:w-3.5" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-[11px] font-medium text-text-muted">{label}</dt>
        <dd className={cn('truncate text-text font-medium', mono && 'font-mono tabular')}>{value}</dd>
      </div>
    </div>
  );
}
