import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardHeaderText, CardTitle } from '@car-v2/ui';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getTenantSettings } from '@/server/queries/tenant-settings.queries';
import { DepotAddressForm } from './_components/depot-address-form';

export default async function TruckSettingsPage() {
  const user = await getCurrentUser();
  const t = await getTranslations('screens.truckSettings');
  const tNav = await getTranslations('nav');

  const settings = await getTenantSettings(user.entId);

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumbs={[{ label: tNav('truckSettings') }]}
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-5 max-w-2xl">
        {/* Depot address */}
        <Card variant="elevated">
          <CardHeader>
            <CardHeaderText>
              <CardTitle>{t('depotAddressTitle')}</CardTitle>
            </CardHeaderText>
          </CardHeader>
          <CardContent>
            <DepotAddressForm initial={settings?.tnsDepotAddress ?? null} />
          </CardContent>
        </Card>

        {/* Fixed costs — link to P&L page */}
        <Card variant="outline" className="p-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-text">{t('monthLabel')} — Chi phí cố định</div>
            <div className="text-xs text-text-muted">{t('subtitle').split(' và ')[1] ?? 'Lương · Khấu hao · Bảo hiểm'}</div>
          </div>
          <Link
            href="/truck/pnl"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline shrink-0"
          >
            {tNav('truckPnl')}
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Card>
      </div>
    </>
  );
}
