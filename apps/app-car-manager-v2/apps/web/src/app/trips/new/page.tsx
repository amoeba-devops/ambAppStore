import { getTranslations } from 'next-intl/server';
import { AppFrame } from '@/components/layout/app-frame';
import { PageContent } from '@/components/layout/page-content';
import { FormPageShell } from '@/components/layout/form-page-shell';
import { Btn } from '@/components/primitives/btn';
import { PhaseGate } from '@/components/primitives/phase-gate';
import { EmptyState } from '@/components/primitives/empty-state';

export default async function NewTripPage() {
  const t = await getTranslations('screens.newTrip');
  const tA = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const tP = await getTranslations('phase');

  return (
    <AppFrame
      title={t('title')}
      subtitle={t('subtitle')}
      breadcrumbs={[tCo('tenant'), tNav('trips'), t('title')]}
      actions={
        <>
          <Btn kind="ghost">{tA('saveDraft')}</Btn>
          <Btn kind="primary">{tA('submit')}</Btn>
        </>
      }
    >
      <PageContent>
        <PhaseGate
          phase="P1"
          description={tP('wipBanner')}
          skeleton={
            <FormPageShell>
              <EmptyState
                icon="plus"
                tone="info"
                title={`${tP('comingIn')} P1`}
                body={tP('phasePlan')}
              />
            </FormPageShell>
          }
        />
      </PageContent>
    </AppFrame>
  );
}
