'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { Badge, Card, CardContent, CardHeader, CardTitle, cn } from '@car-v2/ui';
import type { CarVehicleStatus } from '@car-v2/db/schema';
import { vehicleColor } from './calendar/utils';

interface VehicleLegendItem {
  id: string;
  plate: string;
  status: CarVehicleStatus;
  /** Number of trips currently in IN_PROGRESS / CONFIRMED for the day. */
  activeTripCount: number;
}

interface VehicleLegendProps {
  vehicles: VehicleLegendItem[];
}

const STATUS_TONE: Record<CarVehicleStatus, 'success' | 'info' | 'warning' | 'neutral'> = {
  AVAILABLE:   'success',
  IN_USE:      'info',
  MAINTENANCE: 'warning',
  RETIRED:     'neutral',
};

export function VehicleLegend({ vehicles }: VehicleLegendProps) {
  const t = useTranslations('dashboard.legend');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {vehicles.length === 0 ? (
          <p className="py-2 text-center text-xs text-text-faint">{t('empty')}</p>
        ) : (
          vehicles.map((v) => {
            const color = vehicleColor(v.id);
            const statusLabel =
              v.status === 'IN_USE' && v.activeTripCount > 0
                ? t('inUseCount', { count: v.activeTripCount })
                : v.status === 'AVAILABLE' ? t('available')
                : v.status === 'IN_USE' ? t('inUse')
                : v.status === 'MAINTENANCE' ? t('maintenance')
                : t('retired');
            return (
              <div key={v.id} className="flex items-center gap-2.5 text-sm">
                <span
                  aria-hidden
                  className={cn('inline-block h-3 w-3 shrink-0 rounded-sm border-l-[3px]', color.bg, color.borderL)}
                />
                <span className="flex-1 truncate font-mono text-xs font-semibold text-text">{v.plate}</span>
                <Badge tone={STATUS_TONE[v.status]} size="sm">{statusLabel}</Badge>
              </div>
            );
          })
        )}
        {/* Footer link — same compact arrow-link pattern as TripsListPanel's
         * "Xem tất cả →" so both right-rail cards anchor consistently. */}
        <Link
          href="/vehicles"
          className={cn(
            'mt-1 inline-flex items-center justify-end gap-1 self-end text-xs font-medium',
            'text-text-muted transition-colors hover:text-accent',
            'focus-visible:outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          {t('manageLink')}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
