import { getTranslations } from 'next-intl/server';
import { Car, Fuel } from 'lucide-react';
import { Badge, Card, CardContent, CardHeader, CardHeaderText, CardTitle } from '@car-v2/ui';
import type { DriverVehicleSummary } from '@/server/queries/vehicles.queries';

interface DriverMyVehiclesProps {
  vehicles: DriverVehicleSummary[];
}

const DATE_FMT = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

/* "Phương tiện của tôi" — vehicles this driver has been (or is) assigned to.
 *
 * Layout:
 *  - Mobile (default): 1-col stack, each card has plate + model + last-driven hint
 *  - Desktop (md+): 2-col grid để tận dụng chiều ngang ở web/tablet ngang
 *
 * Hidden entirely when driver has no trip history (no FK to vehicles yet). */
export async function DriverMyVehicles({ vehicles }: DriverMyVehiclesProps) {
  if (vehicles.length === 0) return null;
  const t = await getTranslations('today.driver.myVehicles');

  return (
    <Card>
      <CardHeader>
        <CardHeaderText>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeaderText>
        <span className="text-xs text-text-muted tabular">{t('countSuffix', { n: vehicles.length })}</span>
      </CardHeader>
      <CardContent padded={false}>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3">
          {vehicles.map((v) => (
            <li
              key={v.cvhId}
              className="group flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2.5 hover:border-border-strong transition-colors"
            >
              {/* Plate icon block — kept same width as Avatar size="md" so list aligns
                  with trip rows visually when interleaved. */}
              <div className="h-10 w-10 rounded-md bg-accent-soft text-accent inline-flex items-center justify-center shrink-0">
                <Car className="h-5 w-5" aria-hidden />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-mono font-semibold tabular text-text truncate">{v.cvhPlateNumber}</span>
                  {v.isCurrentlyAssigned && (
                    <Badge tone="info" size="sm">{t('activeNow')}</Badge>
                  )}
                </div>
                <div className="text-xs text-text-muted truncate">
                  {v.cvhModel}
                  {v.cvhMake ? ` · ${v.cvhMake}` : ''}
                  {v.cvhYear ? ` · ${v.cvhYear}` : ''}
                </div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-text-faint flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <Fuel className="h-3 w-3" aria-hidden />
                    {v.cvhFuelType}
                  </span>
                  <span>·</span>
                  <span>{t('tripCount', { n: v.tripCount })}</span>
                  {v.lastTripAt && (
                    <>
                      <span>·</span>
                      <span className="tabular">{t('lastDrivenAt', { date: DATE_FMT.format(v.lastTripAt) })}</span>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
