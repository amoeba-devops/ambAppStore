import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import {
  Camera,
  Car,
  CheckCircle2,
  ChevronRight,
  Clock,
  MapPin,
  Phone,
  Play,
  Receipt,
  X,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardHeaderText,
  CardTitle,
} from '@car-v2/ui';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';

interface UpcomingTrip {
  ref: string;
  passenger: string;
  passengerRole: string;
  pickup: string;
  dropoff: string;
  when: string;
  duration: string;
  vehicle: string;
}

const NEXT_TRIP: UpcomingTrip = {
  ref: 'TR-1042',
  passenger: 'Park Joon-ho',
  passengerRole: 'CEO',
  pickup: '225 Lê Thánh Tôn, D1, HCMC',
  dropoff: 'Tan Son Nhat Intl. T2 — Gate B',
  when: 'Today · 14:30',
  duration: '~75 min',
  vehicle: '51K-238.91 · Hyundai Staria',
};

const LATER_TODAY: UpcomingTrip[] = [
  {
    ref: 'TR-1038',
    passenger: 'Lee Hyun-jung',
    passengerRole: 'Mgr, IT',
    pickup: 'D1 HCMC',
    dropoff: 'Saigon Centre',
    when: 'Today · 18:30',
    duration: '~45 min',
    vehicle: '51K-238.91',
  },
];

export default async function TodayPage() {
  const tA  = await getTranslations('actions');
  const tCo = await getTranslations('company');

  return (
    <AppShell>
      <PageHeader
        title="Today"
        subtitle={`${tCo('currentUser')} · 2 trips scheduled`}
        breadcrumbs={[{ label: tCo('tenant') }, { label: 'Today' }]}
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-4">
        {/* Hero: next trip */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-accent to-info text-accent-fg px-5 py-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider opacity-80">Next trip · in 38 min</div>
              <div className="mt-1 text-lg font-bold font-mono tabular">{NEXT_TRIP.ref}</div>
            </div>
            <Badge tone="solid" size="md" className="bg-white/15 text-white ring-white/20">Confirmed</Badge>
          </div>

          <CardContent>
            <div className="flex items-center gap-3 pb-4 border-b border-border">
              <Avatar name={NEXT_TRIP.passenger} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="text-md font-semibold text-text truncate">{NEXT_TRIP.passenger}</div>
                <div className="text-sm text-text-muted truncate">{NEXT_TRIP.passengerRole}</div>
              </div>
              <Button variant="secondary" size="icon" aria-label="Call passenger">
                <Phone />
              </Button>
            </div>

            <div className="pt-4 space-y-3.5">
              <RouteStep tone="accent"  Icon={MapPin} label="Pickup"   value={NEXT_TRIP.pickup} />
              <RouteStep tone="success" Icon={MapPin} label="Drop-off" value={NEXT_TRIP.dropoff} />
              <div className="flex items-center justify-between text-sm pt-2">
                <span className="inline-flex items-center gap-2 text-text-muted">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="font-medium text-text">{NEXT_TRIP.when}</span>
                  <span className="text-text-faint">· {NEXT_TRIP.duration}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-text-muted">
                  <Car className="h-3.5 w-3.5" />
                  <span className="font-mono tabular text-text">{NEXT_TRIP.vehicle}</span>
                </span>
              </div>
            </div>
          </CardContent>

          {/* Action bar */}
          <div className="grid grid-cols-2 border-t border-border">
            <button className="h-12 inline-flex items-center justify-center gap-2 text-danger font-medium text-sm hover:bg-danger-soft transition-colors border-r border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
              <X className="h-4 w-4" /> Reject
            </button>
            <button className="h-12 inline-flex items-center justify-center gap-2 text-accent font-semibold text-sm hover:bg-accent-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
              <Play className="h-4 w-4" /> Start trip
            </button>
          </div>
        </Card>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-2.5">
          <QuickAction Icon={Camera}    label="Capture receipt" href="/costs" />
          <QuickAction Icon={Receipt}   label="My expenses"     href="/costs" />
          <QuickAction Icon={CheckCircle2} label="Trip history" href="/trips" />
        </div>

        {/* Later today */}
        {LATER_TODAY.length > 0 && (
          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>Later today</CardTitle>
              </CardHeaderText>
            </CardHeader>
            <CardContent padded={false}>
              <ul className="divide-y divide-border">
                {LATER_TODAY.map((t) => (
                  <li key={t.ref}>
                    <Link
                      href={`/trips/${t.ref.toLowerCase()}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    >
                      <div className="font-mono text-xs text-text-muted tabular shrink-0">{t.ref}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-text truncate">{t.passenger}</div>
                        <div className="text-xs text-text-faint truncate">{t.pickup} → {t.dropoff}</div>
                      </div>
                      <div className="text-xs text-text-muted tabular shrink-0">{t.when.replace('Today · ', '')}</div>
                      <ChevronRight className="h-4 w-4 text-text-faint shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Sign-out CTA */}
        <div className="flex justify-center pt-2 pb-4">
          <Button variant="ghost" size="md" asChild>
            <a href="/dev-login">{tA('signOut')}</a>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function RouteStep({ tone, Icon, label, value }: { tone: 'accent' | 'success'; Icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className={
        'mt-0.5 h-7 w-7 rounded-full flex items-center justify-center shrink-0 ' +
        (tone === 'accent' ? 'bg-accent-soft text-accent' : 'bg-success-soft text-success')
      }>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-text-muted">{label}</div>
        <div className="text-sm text-text font-medium leading-snug">{value}</div>
      </div>
    </div>
  );
}

function QuickAction({ Icon, label, href }: { Icon: typeof Camera; label: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-1.5 h-20 rounded-md border border-border bg-surface hover:border-border-strong hover:bg-surface-2 transition-colors text-center px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <Icon className="h-5 w-5 text-accent" />
      <span className="text-xs font-medium text-text leading-tight">{label}</span>
    </Link>
  );
}
