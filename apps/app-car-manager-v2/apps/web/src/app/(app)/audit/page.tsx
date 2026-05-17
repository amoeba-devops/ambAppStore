import { getTranslations } from 'next-intl/server';
import { Download, Search } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@car-v2/ui';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { listAudit } from '@/server/queries/audit.queries';

/* Map common action verbs to a tone for visual scanning. */
function toneFor(action: string): 'success' | 'info' | 'warning' | 'danger' | 'accent' | 'neutral' {
  if (action.includes('ACCEPT') || action.includes('APPROVE')) return 'success';
  if (action.includes('REJECT') || action.includes('CANCEL') || action.includes('DELETE')) return 'danger';
  if (action.includes('ASSIGN') || action.includes('UPDATE')) return 'accent';
  if (action.includes('START') || action.includes('END'))   return 'info';
  if (action.includes('ALERT') || action.includes('WARN'))  return 'warning';
  return 'neutral';
}

export default async function AuditLogPage() {
  const t    = await getTranslations('screens.audit');
  const tA   = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo  = await getTranslations('company');
  const tAu  = await getTranslations('audit');
  const user = await getCurrentUser();
  requireRole(user.role, ['ADMIN']);

  const rows = await listAudit(user.entId, { limit: 100 });

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('auditLog') }]}
        actions={<Button variant="ghost" size="md" iconLeft={<Download />}>{tA('export')} CSV</Button>}
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <Input placeholder={tAu('searchPlaceholder')} iconLeft={<Search />} className="md:w-96" />
          <div className="text-sm text-text-muted">
            <span className="font-semibold text-text tabular">{tAu('recentEvents', { count: rows.length })}</span>
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

        <div className="rounded-md border border-border bg-surface-2/40 px-4 py-3 text-xs text-text-muted leading-relaxed">
          {tAu('appendOnlyNote')} <span className="font-medium text-text">{tAu('appendOnly')}</span>{tAu('appendOnlyDesc')}{' '}
          <span className="font-medium text-text tabular">{tAu('retention')}</span> {tAu('retentionNote')}
        </div>
      </div>
    </>
  );
}
