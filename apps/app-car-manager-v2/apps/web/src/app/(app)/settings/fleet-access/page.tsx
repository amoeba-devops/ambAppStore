import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import {
  Avatar,
  Badge,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@car-v2/ui';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import {
  listFleetMembers,
  listPendingFleetRequests,
} from '@/server/queries/fleet-access.queries';
import { FleetMemberControls } from './_components/fleet-member-controls';
import { FleetRequestActions } from './_components/fleet-request-actions';

function bcp47(locale: string): string {
  if (locale === 'vi') return 'vi-VN';
  if (locale === 'ko') return 'ko-KR';
  return 'en-US';
}

/**
 * Admin fleet-access management (REQ-20260617). Approve pending manager
 * requests for a second department + grant/revoke CAR/TRUCK per member.
 * ADMIN-only — backend actions also enforce requireRole(['ADMIN']).
 */
export default async function FleetAccessPage() {
  const actor = await getCurrentUser();
  if (actor.role !== 'ADMIN') {
    redirect(actor.role === 'DRIVER' ? '/today' : '/dashboard');
  }

  const t = await getTranslations('screens.fleetAccess');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const locale = await getLocale();

  const [members, requests] = await Promise.all([
    listFleetMembers(actor.entId),
    listPendingFleetRequests(actor.entId),
  ]);

  const fmtDate = (d: Date) => new Date(d).toLocaleDateString(bcp47(locale));

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('fleetAccess') }]}
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-6">
        {/* Pending requests queue */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-text">{t('pendingTitle')}</h2>
          {requests.length === 0 ? (
            <Card variant="outline" className="p-6 text-center text-sm text-text-muted">
              {t('pendingEmpty')}
            </Card>
          ) : (
            <ul className="space-y-2.5">
              {requests.map((r) => (
                <li key={r.farId}>
                  <Card variant="outline" className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                      <div className="flex items-start gap-3 min-w-0">
                        <Avatar name={r.requesterName ?? r.requesterEmail ?? '?'} size="md" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-text truncate">
                              {r.requesterName ?? r.requesterEmail ?? r.usrId}
                            </span>
                            <Badge tone="info" size="sm">
                              {t(`dept.${r.vehicleType}`)}
                            </Badge>
                          </div>
                          <div className="text-xs text-text-faint mt-0.5">
                            {t('requestedOn', { date: fmtDate(r.requestedAt) })}
                          </div>
                          {r.reason && (
                            <p className="text-xs text-text-muted mt-1 leading-relaxed">
                              <span className="text-text-faint">{t('reasonLabel')}: </span>
                              {r.reason}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 self-end sm:self-center">
                        <FleetRequestActions requestId={r.farId} />
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Member access table */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-text">{t('membersTitle')}</h2>
          <p className="text-xs text-text-muted">{t('membersHint')}</p>
          <Card variant="outline" className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('thMember')}</TableHead>
                  <TableHead>{t('thRole')}</TableHead>
                  <TableHead className="text-right">{t('thAccess')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.usrId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar name={m.name ?? m.email ?? '?'} size="md" />
                        <div className="min-w-0">
                          <span className="font-medium text-text truncate block">
                            {m.name ?? m.email ?? m.usrId}
                          </span>
                          <div className="text-xs text-text-faint truncate">{m.email ?? '—'}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge tone="neutral" size="sm">
                        {m.localRole}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <FleetMemberControls userId={m.usrId} depts={m.depts} implicit={m.implicit} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </section>
      </div>
    </>
  );
}
