import { getTranslations } from 'next-intl/server';
import {
  Alert,
  AlertDescription,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeaderText,
  CardTitle,
  Label,
} from '@car-v2/ui';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getOrSeedTenantSettings } from '@/server/services/tenant-settings.service';
import { AppNameInput } from './_components/app-name-input';
import { CurrencySelect } from './_components/currency-select';
import { LocaleSelect } from './_components/locale-select';
import { NotifPrefToggle } from './_components/notif-pref-toggle';
import { PushToggle } from './_components/push-toggle';
import { RetentionSelect } from './_components/retention-select';
import { TenantNameInput } from './_components/tenant-name-input';
import { TimezoneSelect } from './_components/timezone-select';

/* Admin Settings — auto-save (no Save button). Each field is a Client subtree
 * that calls its own Server Action on change. Non-Admin roles get a read-only
 * banner + every control disabled (the action still 403s as a backstop). */
export default async function SettingsPage() {
  const t      = await getTranslations('screens.settings');
  const tNav   = await getTranslations('nav');
  const tCo    = await getTranslations('company');
  const tS     = await getTranslations('settings');

  const actor = await getCurrentUser();
  const settings = await getOrSeedTenantSettings(actor.entId, actor.userId);
  const isAdmin = actor.role === 'ADMIN';

  /* Retention options — pre-resolved here so client components stay locale-agnostic. */
  const tripRetentionOptions = [
    { value: '1', label: tS('ret1y') },
    { value: '3', label: tS('ret3y') },
    { value: '5', label: tS('ret5y') },
    { value: '7', label: tS('ret7y') },
  ];
  const auditRetentionOptions = [
    { value: '3', label: tS('ret3y') },
    { value: '5', label: tS('ret5y') },
    { value: '__indefinite__', label: tS('retIndefinite') },
  ];

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('settings') }]}
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6">
        <div className="max-w-[800px] mx-auto space-y-5">
          {!isAdmin && (
            <Alert variant="info">
              <AlertDescription>{tS('viewOnlyNotice')}</AlertDescription>
            </Alert>
          )}

          {/* General */}
          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>{tS('general')}</CardTitle>
                <CardDescription>{tS('generalDesc')}</CardDescription>
              </CardHeaderText>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1.5 block">{tS('appName')}</Label>
                  <AppNameInput defaultValue={settings.tnsAppName} disabled={!isAdmin} />
                </div>
                <div>
                  <Label className="mb-1.5 block">{tS('tenantName')}</Label>
                  <TenantNameInput defaultValue={settings.tnsTenantName} disabled={!isAdmin} />
                </div>
                <div>
                  <Label className="mb-1.5 block">{tS('defaultLanguage')}</Label>
                  <LocaleSelect />
                </div>
                <div>
                  <Label className="mb-1.5 block">{tS('currency')}</Label>
                  <CurrencySelect defaultValue={settings.tnsCurrency} disabled={!isAdmin} />
                </div>
                <div>
                  <Label className="mb-1.5 block">{tS('timezone')}</Label>
                  <TimezoneSelect defaultValue={settings.tnsTimezone} disabled={!isAdmin} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>{tS('notifications')}</CardTitle>
                <CardDescription>{tS('notificationsDesc')}</CardDescription>
              </CardHeaderText>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <NotifPrefToggle
                  field="inapp"
                  title={tS('notifInApp')}
                  description={tS('notifInAppDesc')}
                  defaultChecked={settings.tnsNotifInapp}
                  disabled={!isAdmin}
                />
                <NotifPrefToggle
                  field="email"
                  title={tS('notifEmail')}
                  description={tS('notifEmailDesc')}
                  defaultChecked={settings.tnsNotifEmail}
                  disabled={!isAdmin}
                />
                <PushToggle
                  vapidPublicKey={process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC}
                  basePath={process.env.NEXT_PUBLIC_BASE_PATH ?? ''}
                />
                <NotifPrefToggle
                  field="digest"
                  title={tS('notifDigest')}
                  description={tS('notifDigestDesc')}
                  defaultChecked={settings.tnsNotifDigest}
                  disabled={!isAdmin}
                />
              </div>
            </CardContent>
          </Card>

          {/* Data retention */}
          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>{tS('retention')}</CardTitle>
                <CardDescription>{tS('retentionDesc')}</CardDescription>
              </CardHeaderText>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1.5 block">{tS('tripRecords')}</Label>
                  <RetentionSelect
                    field="trip"
                    defaultValue={settings.tnsRetentionTripYears}
                    options={tripRetentionOptions}
                    disabled={!isAdmin}
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block">{tS('auditLog')}</Label>
                  <RetentionSelect
                    field="audit"
                    defaultValue={settings.tnsRetentionAuditYears}
                    options={auditRetentionOptions}
                    disabled={!isAdmin}
                  />
                </div>
              </div>
              <p className="mt-3 text-xs text-text-faint">{tS('retentionDefault')}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
