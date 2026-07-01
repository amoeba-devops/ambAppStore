import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ArrowRight, Calendar, CheckCircle2, ChevronRight, ClipboardList, Plus, Truck } from 'lucide-react';
import { Badge, Button, Card } from '@car-v2/ui';
import type { TripListItem } from '@/server/queries/trips.queries';
import type { DriverVehicleSummary } from '@/server/queries/vehicles.queries';

function bcp47(locale: string): string {
  if (locale === 'vi') return 'vi-VN';
  if (locale === 'ko') return 'ko-KR';
  return 'en-US';
}

/**
 * Truck driver's "Today" — completion-oriented (no dispatch accept/reject).
 * The screen leads with the trips that still need a log ("Cần hoàn thành") as
 * emphasized, tappable cards, then tucks vehicles + finished trips into a
 * secondary two-column band on desktop. Content is width-constrained so it
 * reads well on a wide desktop yet stacks cleanly on a phone (PWA-first).
 */
export async function TruckDriverToday({
  trips,
  vehicles,
}: {
  trips: TripListItem[];
  vehicles?: DriverVehicleSummary[];
}) {
  const t = await getTranslations('today.truck');
  const locale = await getLocale();
  const loc = bcp47(locale);
  const dateStr = (d: Date | string) =>
    new Date(d).toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = (d: Date | string) =>
    new Date(d).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });

  const logs = trips.filter((tr) => tr.trpKind === 'LOG');
  const todo = logs.filter((tr) => tr.trpStatus === 'CONFIRMED' || tr.trpStatus === 'IN_PROGRESS');
  const done = logs.filter((tr) => tr.trpStatus === 'COMPLETED');
  const hasVehicles = !!vehicles && vehicles.length > 0;

  const completedSection = (
    <section className="space-y-2.5">
      <SectionHead icon={<CheckCircle2 className="h-4 w-4 text-success" />} title={t('completed')} count={done.length} tone="success" />
      {done.length === 0 ? (
        <EmptyLine text={t('noDone')} />
      ) : (
        <ul className="space-y-2">
          {done.map((tr) => (
            <li key={tr.trpId}>
              <Link
                href={`/today/truck/${tr.trpId}`}
                className="flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-2.5 transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-text">{tr.trpCustomer ?? tr.trpRef}</div>
                  <div className="truncate text-xs text-text-faint">
                    {tr.trpPickupAddress} → {tr.trpDropoffAddress}
                  </div>
                </div>
                <span className="shrink-0 text-xs tabular text-text-faint">{dateStr(tr.trpScheduledAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Summary + primary action */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text">{t('title')}</h1>
            <p className="mt-0.5 text-sm text-text-muted">{t('todoSummary', { n: todo.length })}</p>
          </div>
          <Button asChild variant="accent" size="lg" className="w-full gap-1.5 sm:w-auto">
            <Link href="/today/truck/new">
              <Plus className="h-4 w-4" />
              {t('newTrip')}
            </Link>
          </Button>
        </div>

        {/* To-complete — the driver's primary work, emphasized. */}
        <section className="space-y-2.5">
          <SectionHead icon={<ClipboardList className="h-4 w-4 text-warning" />} title={t('toComplete')} count={todo.length} tone="warning" />
          {todo.length === 0 ? (
            <EmptyLine icon={<CheckCircle2 className="h-5 w-5 text-success" />} text={t('noTodo')} />
          ) : (
            <ul className="space-y-2.5">
              {todo.map((tr) => {
                const running = tr.trpStatus === 'IN_PROGRESS';
                return (
                  <li key={tr.trpId}>
                    <Link
                      href={`/today/truck/${tr.trpId}`}
                      className="group flex overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className={'w-1 shrink-0 ' + (running ? 'bg-info' : 'bg-warning')} />
                      <div className="min-w-0 flex-1 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-text">{tr.trpCustomer ?? tr.trpRef}</div>
                            <div className="truncate font-mono text-xs text-text-faint">{tr.trpRef}</div>
                          </div>
                          <Badge tone={running ? 'info' : 'warning'} size="sm">
                            {running ? t('statusRunning') : t('statusPending')}
                          </Badge>
                        </div>
                        <div className="mt-2 flex min-w-0 items-center gap-1.5 text-sm text-text-muted">
                          <span className="truncate">{tr.trpPickupAddress}</span>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-text-faint" />
                          <span className="truncate">{tr.trpDropoffAddress}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-faint">
                          <span className="inline-flex items-center gap-1 tabular">
                            <Calendar className="h-3 w-3" />
                            {dateStr(tr.trpScheduledAt)} · {timeStr(tr.trpScheduledAt)}
                          </span>
                          {tr.vehiclePlate && (
                            <span className="inline-flex items-center gap-1 font-mono">
                              <Truck className="h-3 w-3" />
                              {tr.vehiclePlate}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="hidden shrink-0 items-center gap-1 self-center pr-4 text-accent sm:flex">
                        <span className="text-xs font-semibold">{t('completeCta')}</span>
                        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </div>
                      <div className="flex shrink-0 items-center self-center pr-3 text-text-faint sm:hidden">
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Vehicles + completed — secondary. Two columns on desktop when the
         * driver has vehicles; otherwise the completed list stands alone. */}
        {hasVehicles ? (
          <div className="grid gap-4 md:grid-cols-2">
            <section className="space-y-2.5">
              <SectionHead icon={<Truck className="h-4 w-4 text-text-muted" />} title={t('myVehicles')} />
              <Card variant="outline" className="divide-y divide-border">
                {vehicles!.map((v) => (
                  <div key={v.cvhId} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                      <Truck className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-mono font-semibold text-text">{v.cvhPlateNumber}</div>
                      <div className="truncate text-xs text-text-faint">{v.cvhModel}</div>
                    </div>
                  </div>
                ))}
              </Card>
            </section>
            {completedSection}
          </div>
        ) : (
          completedSection
        )}
      </div>
    </div>
  );
}

function SectionHead({
  icon,
  title,
  count,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  tone?: 'warning' | 'success';
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <h2 className="text-sm font-semibold text-text">{title}</h2>
      {count != null && count > 0 && (
        <Badge tone={tone ?? 'neutral'} size="sm">
          {count}
        </Badge>
      )}
    </div>
  );
}

function EmptyLine({ icon, text }: { icon?: React.ReactNode; text: string }) {
  return (
    <Card variant="outline" className="flex items-center justify-center gap-2 p-5 text-sm text-text-muted">
      {icon}
      <span>{text}</span>
    </Card>
  );
}
