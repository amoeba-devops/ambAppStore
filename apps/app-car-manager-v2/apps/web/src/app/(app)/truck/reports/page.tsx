import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Download, FileText, Plus } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@car-v2/ui';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getTruckReportsSeenAt, listTruckReports, type TruckReportRow } from '@/server/queries/truck-report.queries';
import { MonthPicker } from '@/components/inputs/month-picker';
import { MarkReportsSeen } from './_components/mark-reports-seen';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

function bcp47(locale: string): string {
  if (locale === 'vi') return 'vi-VN';
  if (locale === 'ko') return 'ko-KR';
  return 'en-US';
}

export default async function TruckReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const monthFilter = /^\d{4}-\d{2}$/.test(sp.month ?? '') ? sp.month : undefined;
  const t = await getTranslations('screens.truckReports');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const locale = await getLocale();
  const loc = bcp47(locale);

  const seenAt = await getTruckReportsSeenAt(user.entId, user.userId);
  const reports = await listTruckReports(user.entId, seenAt);

  const monthLabel = (m: string) =>
    new Date(`${m}-01T00:00:00Z`).toLocaleDateString(loc, { month: 'long', year: 'numeric' });
  const dateTime = (d: Date) => new Date(d).toLocaleString(loc);

  /* Month filter ("Lọc theo tháng") — unified month picker (Sheet-2 RL1). */
  const shown = monthFilter ? reports.filter((r) => r.month === monthFilter) : reports;

  /* Group by month, preserving the newest-first order of the flat list. */
  const groups: { month: string; rows: TruckReportRow[] }[] = [];
  for (const r of shown) {
    let g = groups.find((x) => x.month === r.month);
    if (!g) {
      g = { month: r.month, rows: [] };
      groups.push(g);
    }
    g.rows.push(r);
  }

  return (
    <>
      <MarkReportsSeen />
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle', { count: reports.length })}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('truckReports') }]}
        actions={
          <Button variant="accent" size="md" asChild>
            <Link href="/truck/reports/new">
              <Plus />
              {t('createBtn')}
            </Link>
          </Button>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-5">
        {reports.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-text-muted">{t('filterByMonth')}</span>
            <MonthPicker value={monthFilter ?? ''} />
          </label>
        )}
        {groups.length === 0 ? (
          <Card>
            <EmptyState
              icon={<FileText />}
              title={monthFilter && reports.length > 0 ? t('emptyMonthTitle') : t('emptyTitle')}
              description={monthFilter && reports.length > 0 ? t('emptyMonthDesc') : t('emptyDesc')}
              action={
                monthFilter && reports.length > 0 ? undefined : (
                  <Button variant="accent" size="md" asChild>
                    <Link href="/truck/reports/new">
                      <Plus />
                      {t('createBtn')}
                    </Link>
                  </Button>
                )
              }
            />
          </Card>
        ) : (
          groups.map((g) => (
            <div key={g.month} className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-text capitalize">{monthLabel(g.month)}</h2>
                <span className="text-xs text-text-muted">{t('groupCount', { count: g.rows.length })}</span>
              </div>
              {/* Mobile card list — below md the 5-column report table is
               * replaced by cards with a full-width download button. */}
              <ul className="md:hidden space-y-2.5">
                {g.rows.map((r) => (
                  <li key={r.id} className="rounded-md border border-border bg-surface px-4 py-3.5">
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-text-faint mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-text">{r.name}</span>
                          {r.isNew && <Badge tone="accent" size="sm">{t('newBadge')}</Badge>}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
                          <Badge tone="neutral" size="sm">{r.format}</Badge>
                          <span className="tabular">· {dateTime(r.createdAt)}</span>
                          {r.createdByName && <span>· {r.createdByName}</span>}
                        </div>
                      </div>
                    </div>
                    <Button variant="secondary" size="sm" className="mt-3 w-full" asChild>
                      <a href={`${BASE_PATH}/truck/reports/${r.id}/download`}>
                        <Download className="h-3.5 w-3.5" />
                        {t('download')}
                      </a>
                    </Button>
                  </li>
                ))}
              </ul>

              {/* Desktop table */}
              <Card variant="outline" className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('thName')}</TableHead>
                      <TableHead>{t('thFormat')}</TableHead>
                      <TableHead>{t('thCreated')}</TableHead>
                      <TableHead>{t('thBy')}</TableHead>
                      <TableHead className="text-right">{t('thDownload')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 shrink-0 text-text-faint" />
                            <span className="text-text">{r.name}</span>
                            {r.isNew && (
                              <Badge tone="accent" size="sm">
                                {t('newBadge')}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge tone="neutral" size="sm">{r.format}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular text-text-muted">{dateTime(r.createdAt)}</TableCell>
                        <TableCell className="text-text-muted">{r.createdByName ?? '—'}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <a href={`${BASE_PATH}/truck/reports/${r.id}/download`}>
                              <Download className="h-3.5 w-3.5" />
                              {t('download')}
                            </a>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          ))
        )}
      </div>
    </>
  );
}
