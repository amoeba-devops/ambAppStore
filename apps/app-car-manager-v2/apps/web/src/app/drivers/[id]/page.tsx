import { getTranslations } from 'next-intl/server';
import { AppFrame } from '@/components/layout/app-frame';
import { PageContent } from '@/components/layout/page-content';
import { DetailPageShell } from '@/components/layout/detail-page-shell';
import { Btn } from '@/components/primitives/btn';
import { PhaseGate } from '@/components/primitives/phase-gate';
import { EmptyState } from '@/components/primitives/empty-state';

export default async function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations('screens.driverDetail');
  const tA = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const tP = await getTranslations('phase');

  return (
    <AppFrame
      title={t('title')}
      subtitle={`${id} · ${t('subtitle')}`}
      breadcrumbs={[tCo('tenant'), tNav('drivers'), id]}
      actions={<Btn kind="ghost">{tA('edit')}</Btn>}
    >
      <PageContent>
        <PhaseGate
          phase="P1"
          description={tP('wipBanner')}
          skeleton={
            <DetailPageShell>
              <EmptyState icon="user" tone="info" title={`${tP('comingIn')} P1`} body={tP('phasePlan')} />
            </DetailPageShell>
          }
        />
      </PageContent>
    </AppFrame>
  );
}
