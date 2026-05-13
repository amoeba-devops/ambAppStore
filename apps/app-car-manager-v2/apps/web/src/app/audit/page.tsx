import { getTranslations } from 'next-intl/server';
import { Download, Search } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@car-v2/ui';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';

interface AuditRow {
  at: string;
  actor: string;
  action: string;
  entity: string;
  ref: string;
  ip: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
}

const LOGS: AuditRow[] = [
  { at: '2026-05-12T14:38:21+07:00', actor: 'Nguyễn Văn Tú',  action: 'TRIP.ARRIVE',    entity: 'Trip',    ref: 'TR-1042', ip: '14.241.83.12',  tone: 'success' },
  { at: '2026-05-12T14:30:09+07:00', actor: 'Nguyễn Văn Tú',  action: 'TRIP.START',     entity: 'Trip',    ref: 'TR-1042', ip: '14.241.83.12',  tone: 'info'    },
  { at: '2026-05-12T14:12:55+07:00', actor: 'Nguyễn Văn Tú',  action: 'TRIP.ACCEPT',    entity: 'Trip',    ref: 'TR-1042', ip: '14.241.83.12',  tone: 'success' },
  { at: '2026-05-12T13:55:12+07:00', actor: 'Park Joon-ho',   action: 'TRIP.ASSIGN',    entity: 'Trip',    ref: 'TR-1042', ip: '203.205.47.8',  tone: 'accent'  },
  { at: '2026-05-12T13:48:02+07:00', actor: 'Park Joon-ho',   action: 'TRIP.CREATE',    entity: 'Trip',    ref: 'TR-1042', ip: '203.205.47.8',  tone: 'neutral' },
  { at: '2026-05-12T11:14:30+07:00', actor: 'Park Joon-ho',   action: 'EXPENSE.APPROVE', entity: 'Expense', ref: 'EXP-509', ip: '203.205.47.8',  tone: 'success' },
  { at: '2026-05-12T10:02:18+07:00', actor: 'Lê Minh Đức',    action: 'EXPENSE.SUBMIT', entity: 'Expense', ref: 'EXP-512', ip: '14.241.96.41',  tone: 'info'    },
  { at: '2026-05-12T09:38:44+07:00', actor: 'Trần Quốc Hùng', action: 'TRIP.REJECT',    entity: 'Trip',    ref: 'TR-1035', ip: '14.241.91.07',  tone: 'danger'  },
  { at: '2026-05-12T09:31:00+07:00', actor: 'system',         action: 'OIL.ALERT',     entity: 'Vehicle', ref: '30A-556.07', ip: '—',          tone: 'warning' },
  { at: '2026-05-12T08:00:00+07:00', actor: 'system',         action: 'CRON.MAINT.SCAN', entity: 'System', ref: '—',         ip: '—',          tone: 'neutral' },
];

export default async function AuditLogPage() {
  const t    = await getTranslations('screens.audit');
  const tA   = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo  = await getTranslations('company');

  return (
    <AppShell>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('auditLog') }]}
        actions={<Button variant="ghost" size="md" iconLeft={<Download />}>{tA('export')} CSV</Button>}
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Input placeholder="Search by actor, action, entity ref…" iconLeft={<Search />} className="w-96" />
          <div className="text-sm text-text-muted">
            <span className="font-semibold text-text tabular">{LOGS.length}</span> events · last 24 hours
          </div>
        </div>

        <Card variant="outline" className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Timestamp</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Ref</TableHead>
                <TableHead className="w-[140px]">IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {LOGS.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs text-text-muted tabular">
                    {new Date(row.at).toISOString().replace('T', ' ').slice(0, 19)}
                  </TableCell>
                  <TableCell>
                    {row.actor === 'system' ? (
                      <span className="font-mono text-xs text-text-faint italic">system</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Avatar name={row.actor} size="xs" />
                        <span className="text-sm text-text">{row.actor}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge tone={row.tone} size="sm">
                      <span className="font-mono tabular text-[10.5px]">{row.action}</span>
                    </Badge>
                  </TableCell>
                  <TableCell className="text-text-muted">{row.entity}</TableCell>
                  <TableCell className="font-mono text-xs text-text tabular">{row.ref}</TableCell>
                  <TableCell className="font-mono text-xs text-text-faint tabular">{row.ip}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <div className="rounded-md border border-border bg-surface-2/40 px-4 py-3 text-xs text-text-muted leading-relaxed">
          Audit log is <span className="font-medium text-text">append-only</span> — records cannot be edited or deleted (CLAUDE.md §8).
          Retention: <span className="font-medium text-text tabular">5 years</span> per NFR-10.
        </div>
      </div>
    </AppShell>
  );
}
