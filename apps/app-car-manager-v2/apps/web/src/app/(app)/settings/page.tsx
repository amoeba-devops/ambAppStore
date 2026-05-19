import { getTranslations } from 'next-intl/server';
import { Save } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeaderText,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@car-v2/ui';
import { PageHeader } from '@/components/layout/page-header';
import { LocaleSelect } from './_components/locale-select';
import { PushToggle } from './_components/push-toggle';

const APPROVAL_RULES: Array<{ typeKey: string; needsApproval: boolean; threshold: string }> = [
  { typeKey: 'FUEL',       needsApproval: false, threshold: '—' },
  { typeKey: 'OIL',        needsApproval: false, threshold: '—' },
  { typeKey: 'PARKING',    needsApproval: false, threshold: '—' },
  { typeKey: 'TOLL',       needsApproval: false, threshold: '—' },
  { typeKey: 'MEAL',       needsApproval: false, threshold: '500,000₫ (warn)' },
  { typeKey: 'REPAIR',     needsApproval: true,  threshold: '1,000,000₫' },
  { typeKey: 'ACCIDENT',   needsApproval: true,  threshold: '—' },
  { typeKey: 'INSPECTION', needsApproval: false, threshold: '—' },
];

export default async function SettingsPage() {
  const t       = await getTranslations('screens.settings');
  const tA      = await getTranslations('actions');
  const tNav    = await getTranslations('nav');
  const tCo     = await getTranslations('company');
  const tS      = await getTranslations('settings');
  const tCost   = await getTranslations('costs.types');

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('settings') }]}
        actions={<Button variant="accent" size="md" iconLeft={<Save />}>{tA('save')}</Button>}
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6">
        <div className="max-w-[800px] mx-auto space-y-5">
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
                  <Label className="mb-1.5 block">{tS('tenantName')}</Label>
                  <Input defaultValue={tCo('tenant')} />
                </div>
                <div>
                  <Label className="mb-1.5 block">{tS('defaultLanguage')}</Label>
                  <LocaleSelect />
                </div>
                <div>
                  <Label className="mb-1.5 block">{tS('currency')}</Label>
                  <Select defaultValue="vnd">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vnd">VND · ₫</SelectItem>
                      <SelectItem value="krw">KRW · ₩</SelectItem>
                      <SelectItem value="usd">USD · $</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block">{tS('timezone')}</Label>
                  <Select defaultValue="vn">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vn">Asia/Ho_Chi_Minh</SelectItem>
                      <SelectItem value="kr">Asia/Seoul</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Approval rules */}
          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>{tS('approval')}</CardTitle>
                <CardDescription>{tS('approvalDesc')}</CardDescription>
              </CardHeaderText>
            </CardHeader>
            <CardContent padded={false}>
              <ul className="divide-y divide-border">
                {APPROVAL_RULES.map((r) => (
                  <li key={r.typeKey} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-text">{tCost(r.typeKey)}</div>
                      <div className="text-xs text-text-faint">{tS('approvalThreshold')} <span className="tabular">{r.threshold}</span></div>
                    </div>
                    {r.needsApproval ? (
                      <Badge tone="warning" size="sm">{tS('approvalRequired')}</Badge>
                    ) : (
                      <Badge tone="success" size="sm">{tS('autoApproved')}</Badge>
                    )}
                  </li>
                ))}
              </ul>
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
                <ToggleRow title={tS('notifInApp')}  description={tS('notifInAppDesc')}  defaultChecked />
                <ToggleRow title={tS('notifEmail')}  description={tS('notifEmailDesc')}  defaultChecked />
                <PushToggle
                  vapidPublicKey={process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC}
                  basePath={process.env.NEXT_PUBLIC_BASE_PATH ?? ''}
                />
                <ToggleRow title={tS('notifDigest')} description={tS('notifDigestDesc')} defaultChecked />
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
                  <Select defaultValue="5y">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1y">{tS('ret1y')}</SelectItem>
                      <SelectItem value="3y">{tS('ret3y')}</SelectItem>
                      <SelectItem value="5y">{tS('ret5y')}</SelectItem>
                      <SelectItem value="7y">{tS('ret7y')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block">{tS('auditLog')}</Label>
                  <Select defaultValue="5y">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3y">{tS('ret3y')}</SelectItem>
                      <SelectItem value="5y">{tS('ret5y')}</SelectItem>
                      <SelectItem value="indefinite">{tS('retIndefinite')}</SelectItem>
                    </SelectContent>
                  </Select>
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

function ToggleRow({ title, description, defaultChecked }: { title: string; description: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-medium text-text">{title}</div>
        <div className="text-xs text-text-muted mt-0.5">{description}</div>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}
