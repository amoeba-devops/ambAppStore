import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Download, Search } from 'lucide-react';
import {
  Avatar,
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
import { DebouncedSearchInput } from '@/components/inputs/debounced-search';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { listAudit, listAuditActors } from '@/server/queries/audit.queries';
import { AuditActorFilter } from './_components/audit-actor-filter';

/* Map common action verbs to a tone for visual scanning. */
function toneFor(action: string): 'success' | 'info' | 'warning' | 'danger' | 'accent' | 'neutral' {
  if (action.includes('ACCEPT') || action.includes('APPROVE')) return 'success';
  if (action.includes('REJECT') || action.includes('CANCEL') || action.includes('DELETE')) return 'danger';
  if (action.includes('ASSIGN') || action.includes('UPDATE')) return 'accent';
  if (action.includes('START') || action.includes('END'))   return 'info';
  if (action.includes('ALERT') || action.includes('WARN'))  return 'warning';
  return 'neutral';
}

interface PageProps {
  searchParams: Promise<{ q?: string; actor?: string; page?: string }>;
}

export default async function AuditLogPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const searchQ = sp.q?.trim() || undefined;
  const actorIdRaw = sp.actor?.trim() || undefined;
  const page = Math.max(1, Number(sp.page ?? 1));

  const t    = await getTranslations('screens.audit');
  const tA   = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo  = await getTranslations('company');
  const tAu  = await getTranslations('audit');
  const user = await getCurrentUser();
  requireRole(user.role, ['ADMIN']);

  /* Lấy danh sách actor distinct trong tenant để render dropdown.
   * Đồng thời whitelist `actorIdRaw` — chỉ cho phép filter ID nằm trong danh sách
   * này (chặn URL-injection để xem audit của tenant khác). */
  const actors = await listAuditActors(user.entId);
  const actorId = actorIdRaw && actors.some((a) => a.id === actorIdRaw) ? actorIdRaw : undefined;

  /* listAudit ent-scoped server-side: filters[0] = eq(entId). Search + actorId
   * chỉ thu hẹp scope đã ent-scoped, không thể bypass. */
  const { items: rows, total, pageSize } = await listAudit(user.entId, {
    pageSize: 50,
    page,
    q: searchQ,
    actorId,
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(total, page * pageSize);

  /* Export URL preserve filters hiện tại (q + actor). Server route handler đọc
   * cùng searchParams + ent-scope ADMIN-only. */
  const exportHref = (() => {
    const params = new URLSearchParams();
    if (searchQ) params.set('q', searchQ);
    if (actorId) params.set('actor', actorId);
    const qs = params.toString();
    return qs ? `/api/v1/audit/export?${qs}` : '/api/v1/audit/export';
  })();

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('auditLog') }]}
        actions={
          <Button variant="ghost" size="md" iconLeft={<Download />} asChild>
            <a href={exportHref} download>{tA('export')} CSV</a>
          </Button>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-start md:items-center md:justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 min-w-0">
            <DebouncedSearchInput
              placeholder={tAu('searchPlaceholder')}
              className="flex-1 md:max-w-md"
              clearLabel={tA('clear')}
            />
            {/* Actor filter — Select with ent-scoped users. Whitelist enforced
             *  server-side trong page (actors.some(id===actorId) check). */}
            <AuditActorFilter
              actors={actors}
              currentActorId={actorId}
              allLabel={tAu('actorFilterAll')}
              placeholder={tAu('actorFilterPlaceholder')}
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-text-muted shrink-0">
            <span className="font-semibold text-text tabular">{tAu('recentEvents', { count: total })}</span>
            {(searchQ || actorId) && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/audit">{tA('clear')}</Link>
              </Button>
            )}
          </div>
        </div>

        {rows.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Search />}
              title={tAu('emptyTitle')}
              description={tAu('emptyDesc')}
            />
          </Card>
        ) : (
          <Card variant="outline" className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">{tAu('thTimestamp')}</TableHead>
                  <TableHead>{tAu('thActor')}</TableHead>
                  <TableHead>{tAu('thAction')}</TableHead>
                  <TableHead>{tAu('thEntity')}</TableHead>
                  <TableHead>{tAu('thRef')}</TableHead>
                  <TableHead className="w-[140px]">{tAu('thIp')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.audId}>
                    <TableCell className="font-mono text-xs text-text-muted tabular">
                      {new Date(row.audCreatedAt).toISOString().replace('T', ' ').slice(0, 19)}
                    </TableCell>
                    <TableCell>
                      {row.actorName ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={row.actorName} size="xs" />
                          <span className="text-sm text-text">{row.actorName}</span>
                        </div>
                      ) : (
                        <span className="font-mono text-xs text-text-faint italic">system</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge tone={toneFor(row.audAction)} size="sm">
                        <span className="font-mono tabular text-[10.5px]">{row.audAction}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-text-muted">{row.audEntity}</TableCell>
                    <TableCell className="font-mono text-xs text-text tabular">{row.audEntityRef ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs text-text-faint tabular">{row.audIp ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {totalPages > 1 && (
          <div className="flex flex-col-reverse md:flex-row md:items-center md:justify-between gap-3 text-sm text-text-muted">
            <span className="text-xs md:text-sm">
              {tAu('showing')}{' '}
              <span className="font-semibold text-text tabular">{showingFrom}–{showingTo}</span>{' '}
              {tAu('of')}{' '}
              <span className="font-semibold text-text tabular">{total}</span>
            </span>
            <div className="inline-flex items-center gap-1 self-end md:self-auto">
              {page > 1 ? (
                <Button variant="ghost" size="sm" asChild>
                  <Link href={auditPageHref(page - 1, searchQ, actorId)}>{tAu('previous')}</Link>
                </Button>
              ) : (
                <Button variant="ghost" size="sm" disabled>{tAu('previous')}</Button>
              )}
              <span className="px-3 text-sm tabular">{page} / {totalPages}</span>
              {page < totalPages ? (
                <Button variant="ghost" size="sm" asChild>
                  <Link href={auditPageHref(page + 1, searchQ, actorId)}>{tAu('next')}</Link>
                </Button>
              ) : (
                <Button variant="ghost" size="sm" disabled>{tAu('next')}</Button>
              )}
            </div>
          </div>
        )}

        <div className="rounded-md border border-border bg-surface-2/40 px-4 py-3 text-xs text-text-muted leading-relaxed">
          {tAu('appendOnlyNote')} <span className="font-medium text-text">{tAu('appendOnly')}</span>{tAu('appendOnlyDesc')}{' '}
          <span className="font-medium text-text tabular">{tAu('retention')}</span> {tAu('retentionNote')}
        </div>
      </div>
    </>
  );
}

/* Build /audit URL preserve current filter context. */
function auditPageHref(page: number, q: string | undefined, actor: string | undefined): string {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (actor) params.set('actor', actor);
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `/audit?${qs}` : '/audit';
}
