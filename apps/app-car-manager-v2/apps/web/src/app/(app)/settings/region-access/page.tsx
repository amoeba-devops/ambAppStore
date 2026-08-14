import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
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
import { TRUCK_REGIONS } from '@car-v2/shared/zod';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listRegionAccessMembers } from '@/server/queries/region-access.queries';
import { RegionMemberControls } from './_components/region-member-controls';

/**
 * Admin region-access management (REQ-20260813). Narrow a truck member to a
 * subset of operating regions; leaving every region unticked keeps the default,
 * which is access to all of them. ADMIN-only — the actions re-check server-side.
 */
export default async function RegionAccessPage() {
  const actor = await getCurrentUser();
  if (actor.role !== 'ADMIN') {
    redirect(actor.role === 'DRIVER' ? '/today' : '/dashboard');
  }

  const t = await getTranslations('screens.regionAccess');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const tRegion = await getTranslations('region');

  const members = await listRegionAccessMembers(actor.entId);
  const regionLabels = Object.fromEntries(TRUCK_REGIONS.map((r) => [r, tRegion(r)]));

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('regionAccess') }]}
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-6">
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-text">{t('membersTitle')}</h2>
          <p className="text-xs text-text-muted">{t('membersHint')}</p>
          {members.length === 0 ? (
            <Card variant="outline" className="p-6 text-center text-sm text-text-muted">
              {t('membersEmpty')}
            </Card>
          ) : (
            <>
            {/* Mobile card list — the table's third column pushes the region
             * toggles past a phone's viewport, so below md each member becomes
             * a card with the controls on their own full-width row. */}
            <ul className="md:hidden space-y-2.5">
              {members.map((m) => (
                <li key={m.usrId}>
                  <Card variant="outline" className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <Avatar name={m.name ?? m.email ?? '?'} size="md" />
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-text truncate block">
                          {m.name ?? m.email ?? m.usrId}
                        </span>
                        <div className="text-xs text-text-faint truncate">{m.email ?? '—'}</div>
                      </div>
                      <Badge tone="neutral" size="sm">
                        {m.localRole}
                      </Badge>
                    </div>
                    <RegionMemberControls
                      userId={m.usrId}
                      memberName={m.name ?? m.email ?? m.usrId}
                      regions={m.regions}
                      implicit={m.implicit}
                      regionLabels={regionLabels}
                    />
                  </Card>
                </li>
              ))}
            </ul>

            <Card variant="outline" className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('thMember')}</TableHead>
                    <TableHead>{t('thRole')}</TableHead>
                    <TableHead className="text-right">{t('thRegions')}</TableHead>
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
                        <RegionMemberControls
                          userId={m.usrId}
                          memberName={m.name ?? m.email ?? m.usrId}
                          regions={m.regions}
                          implicit={m.implicit}
                          regionLabels={regionLabels}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
            </>
          )}
        </section>
      </div>
    </>
  );
}
