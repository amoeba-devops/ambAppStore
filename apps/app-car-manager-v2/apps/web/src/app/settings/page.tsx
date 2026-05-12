import { getTranslations } from 'next-intl/server';
import { AppFrame } from '@/components/layout/app-frame';
import { PageContent } from '@/components/layout/page-content';
import { FormPageShell } from '@/components/layout/form-page-shell';
import { Btn } from '@/components/primitives/btn';
import { PhaseGate } from '@/components/primitives/phase-gate';
import { EmptyState } from '@/components/primitives/empty-state';

export default async function SettingsPage() {
  const t = await getTranslations('screens.settings');
  const tA = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const tP = await getTranslations('phase');

  return (
    <AppFrame
      title={t('title')}
      subtitle={t('subtitle')}
      breadcrumbs={[tCo('tenant'), tNav('settings')]}
      actions={<Btn kind="primary">{tA('save')}</Btn>}
    >
      <PageContent>
        <PhaseGate
          phase="P1"
          description={tP('wipBanner')}
          skeleton={
            <FormPageShell>
              <EmptyState icon="settings" tone="info" title={`${tP('comingIn')} P1`} body={tP('phasePlan')} />
            </FormPageShell>
          }
        />
      </PageContent>
    </AppFrame>
  );
}
