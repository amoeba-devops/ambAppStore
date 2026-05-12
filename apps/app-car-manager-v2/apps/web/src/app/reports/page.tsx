import { getTranslations } from 'next-intl/server';
import { AppFrame } from '@/components/layout/app-frame';
import { PageContent } from '@/components/layout/page-content';
import { Btn } from '@/components/primitives/btn';
import { PhaseGate } from '@/components/primitives/phase-gate';
import { EmptyState } from '@/components/primitives/empty-state';

export default async function ReportsPage() {
  const t = await getTranslations('screens.reports');
  const tA = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const tP = await getTranslations('phase');

  return (
    <AppFrame
      title={t('title')}
      subtitle={t('subtitle')}
      breadcrumbs={[tCo('tenant'), tNav('reports')]}
      actions={<Btn kind="ghost" icon="download">{tA('export')}</Btn>}
    >
      <PageContent>
        <PhaseGate
          phase="P3"
          description={tP('wipBanner')}
          skeleton={
            <EmptyState icon="reports" tone="info" title={`${tP('comingIn')} P3`} body={tP('phasePlan')} />
          }
        />
      </PageContent>
    </AppFrame>
  );
}
