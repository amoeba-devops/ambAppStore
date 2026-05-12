import { getTranslations } from 'next-intl/server';
import { AppFrame } from '@/components/layout/app-frame';
import { PageContent } from '@/components/layout/page-content';
import { ListPageShell } from '@/components/layout/list-page-shell';
import { Btn } from '@/components/primitives/btn';
import { PhaseGate } from '@/components/primitives/phase-gate';
import { EmptyState } from '@/components/primitives/empty-state';

export default async function VehiclesPage() {
  const t = await getTranslations('screens.vehicles');
  const tA = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const tP = await getTranslations('phase');

  return (
    <AppFrame
      title={t('title')}
      subtitle={t('subtitle')}
      breadcrumbs={[tCo('tenant'), tNav('vehicles')]}
      actions={
        <>
          <Btn kind="ghost" icon="download">{tA('export')}</Btn>
          <Btn kind="primary" icon="plus">{tA('new')}</Btn>
        </>
      }
    >
      <PageContent>
        <PhaseGate
          phase="P1"
          description={tP('wipBanner')}
          skeleton={
            <ListPageShell>
              <EmptyState icon="vehicles" tone="info" title={`${tP('comingIn')} P1`} body={tP('phasePlan')} />
            </ListPageShell>
          }
        />
      </PageContent>
    </AppFrame>
  );
}
