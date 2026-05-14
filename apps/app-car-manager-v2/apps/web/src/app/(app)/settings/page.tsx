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

const APPROVAL_RULES: Array<{ type: string; needsApproval: boolean; threshold: string }> = [
  { type: 'Fuel',       needsApproval: false, threshold: '—' },
  { type: 'Oil',        needsApproval: false, threshold: '—' },
  { type: 'Parking',    needsApproval: false, threshold: '—' },
  { type: 'Toll',       needsApproval: false, threshold: '—' },
  { type: 'Meal',       needsApproval: false, threshold: '500,000₫ (warn)' },
  { type: 'Repair',     needsApproval: true,  threshold: '1,000,000₫' },
  { type: 'Accident',   needsApproval: true,  threshold: '—' },
  { type: 'Inspection', needsApproval: false, threshold: '—' },
];

export default async function SettingsPage() {
  const t    = await getTranslations('screens.settings');
  const tA   = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo  = await getTranslations('company');

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
                <CardTitle>General</CardTitle>
                <CardDescription>Workspace identity and locale defaults.</CardDescription>
              </CardHeaderText>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1.5 block">Tenant name</Label>
                  <Input defaultValue={tCo('tenant')} />
                </div>
                <div>
                  <Label className="mb-1.5 block">Default language</Label>
                  <Select defaultValue="vi">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vi">Tiếng Việt</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ko">한국어</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block">Currency</Label>
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
                  <Label className="mb-1.5 block">Timezone</Label>
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
                <CardTitle>Expense approval rules</CardTitle>
                <CardDescription>Per category — defines who/when an expense needs review (PRD §6.2.2).</CardDescription>
              </CardHeaderText>
            </CardHeader>
            <CardContent padded={false}>
              <ul className="divide-y divide-border">
                {APPROVAL_RULES.map((r) => (
                  <li key={r.type} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-text">{r.type}</div>
                      <div className="text-xs text-text-faint">Auto-approve threshold: <span className="tabular">{r.threshold}</span></div>
                    </div>
                    {r.needsApproval ? (
                      <Badge tone="warning" size="sm">Approval required</Badge>
                    ) : (
                      <Badge tone="success" size="sm">Auto-approved</Badge>
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
                <CardTitle>Notifications</CardTitle>
                <CardDescription>How the system reaches admins and drivers.</CardDescription>
              </CardHeaderText>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <ToggleRow title="In-app notifications" description="Bell icon in the top bar." defaultChecked />
                <ToggleRow title="Email notifications" description="Send to user's primary email." defaultChecked />
                <ToggleRow title="Web push (PWA)" description="Browser push for installed drivers · P4." />
                <ToggleRow title="Daily digest" description="9:00 AM summary of pending approvals." defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* Data retention */}
          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>Data retention</CardTitle>
                <CardDescription>How long records are kept before purge.</CardDescription>
              </CardHeaderText>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1.5 block">Trip records</Label>
                  <Select defaultValue="5y">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1y">1 year</SelectItem>
                      <SelectItem value="3y">3 years</SelectItem>
                      <SelectItem value="5y">5 years (default)</SelectItem>
                      <SelectItem value="7y">7 years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block">Audit log</Label>
                  <Select defaultValue="5y">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3y">3 years</SelectItem>
                      <SelectItem value="5y">5 years (default)</SelectItem>
                      <SelectItem value="indefinite">Indefinite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="mt-3 text-xs text-text-faint">Default 5 years to satisfy NFR-10 (PRD §7).</p>
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
