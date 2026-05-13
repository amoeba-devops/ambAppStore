import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ChevronLeft, MapPin, Plus, Save } from 'lucide-react';
import {
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
  Separator,
  Textarea,
} from '@car-v2/ui';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';

export default async function NewTripPage() {
  const t    = await getTranslations('screens.newTrip');
  const tA   = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo  = await getTranslations('company');

  return (
    <AppShell>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumbs={[
          { label: tCo('tenant') },
          { label: tNav('trips'), href: '/trips' },
          { label: t('title') },
        ]}
        actions={
          <>
            <Button variant="ghost" size="md" asChild>
              <Link href="/trips"><ChevronLeft />{tA('back')}</Link>
            </Button>
            <Button variant="secondary" size="md" iconLeft={<Save />}>{tA('saveDraft')}</Button>
            <Button variant="accent" size="md" iconLeft={<Plus />}>{tA('submit')}</Button>
          </>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6">
        <form className="max-w-[720px] mx-auto space-y-5" aria-label={t('title')}>
          {/* Trip basics */}
          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>Trip details</CardTitle>
                <CardDescription>Who is travelling and why.</CardDescription>
              </CardHeaderText>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Passenger" required>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select passenger…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="park">Park Joon-ho (CEO)</SelectItem>
                      <SelectItem value="kim">Kim Min-seo (Director, Ops)</SelectItem>
                      <SelectItem value="choi">Choi Ji-woo (Director, Sales)</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Number of passengers">
                  <Input type="number" defaultValue={1} min={1} max={7} />
                </FormField>
                <FormField label="Purpose" required hint="One line — used in approvals." className="col-span-2">
                  <Input placeholder="e.g. Airport pickup for Seoul HQ delegation" />
                </FormField>
                <FormField label="Notes" className="col-span-2">
                  <Textarea placeholder="Optional context, special requirements, etc." rows={3} />
                </FormField>
              </div>
            </CardContent>
          </Card>

          {/* Schedule + route */}
          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>Schedule &amp; route</CardTitle>
                <CardDescription>Pickup, drop-off and timing.</CardDescription>
              </CardHeaderText>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Pickup address" required iconLeft={<MapPin />} className="col-span-2">
                  <Input iconLeft={<MapPin />} placeholder="Building, street, district…" />
                </FormField>
                <FormField label="Drop-off address" required iconLeft={<MapPin />} className="col-span-2">
                  <Input iconLeft={<MapPin />} placeholder="Building, street, district…" />
                </FormField>
                <FormField label="Pickup date &amp; time" required>
                  <Input type="datetime-local" />
                </FormField>
                <FormField label="Expected duration">
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select duration" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.5">30 minutes</SelectItem>
                      <SelectItem value="1">1 hour</SelectItem>
                      <SelectItem value="2">2 hours</SelectItem>
                      <SelectItem value="4">Half day (4h)</SelectItem>
                      <SelectItem value="8">Full day (8h)</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
              <Separator className="my-5" />
              <div className="rounded-md border border-dashed border-border px-4 py-3 bg-surface-2/40">
                <div className="text-xs font-medium text-text-muted mb-1">Stopovers (optional)</div>
                <div className="text-xs text-text-faint">No stops added. Add up to 3 stopovers along the route.</div>
                <Button variant="ghost" size="sm" iconLeft={<Plus />} className="mt-2">Add stopover</Button>
              </div>
            </CardContent>
          </Card>

          {/* Assignment (optional per PRD §6 D1/D2) */}
          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>Assignment</CardTitle>
                <CardDescription>Optional — Admin can assign later.</CardDescription>
              </CardHeaderText>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Driver">
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Leave for Admin to assign" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tu">Nguyễn Văn Tú</SelectItem>
                      <SelectItem value="hung">Trần Quốc Hùng</SelectItem>
                      <SelectItem value="duc">Lê Minh Đức</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Vehicle">
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Leave for Admin to assign" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="51k">51K-238.91 — Hyundai Staria</SelectItem>
                      <SelectItem value="30a">30A-556.07 — Kia Carnival</SelectItem>
                      <SelectItem value="51f">51F-712.34 — Toyota Camry</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            </CardContent>
          </Card>

          {/* Sticky footer action — full-width on mobile, stuck to viewport bottom */}
          <div className="md:flex md:justify-end md:gap-2 md:pt-2 md:static md:bg-transparent md:px-0 md:py-0 md:border-t-0
            sticky bottom-0 -mx-4 px-4 py-3 bg-bg/95 backdrop-blur border-t border-border flex gap-2">
            <Button variant="secondary" size="lg" className="flex-1 md:flex-initial" iconLeft={<Save />}>{tA('saveDraft')}</Button>
            <Button variant="accent" size="lg" className="flex-1 md:flex-initial" iconLeft={<Plus />}>{tA('submit')}</Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

interface FormFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  iconLeft?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

function FormField({ label, required, hint, className, children }: FormFieldProps) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block" required={required}>{label}</Label>
      {children}
      {hint && <div className="text-xs text-text-faint mt-1">{hint}</div>}
    </div>
  );
}
