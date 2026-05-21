'use client';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Check, Droplet, ShieldAlert, Wrench } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  toast,
} from '@car-v2/ui';
import type { CarMaintenanceAlertType } from '@car-v2/db/schema';
import type { MaintenanceAlertListItem } from '@/server/queries/maintenance-alerts.queries';
import { acknowledgeAlertAction } from '@/server/actions/maintenance/maintenance.actions';

const ALERT_ICON: Record<CarMaintenanceAlertType, typeof Droplet> = {
  OIL_OVERDUE: Droplet,
  OIL_DUE_SOON: Droplet,
  INSPECTION_OVERDUE: ShieldAlert,
  INSPECTION_DUE_SOON: ShieldAlert,
};

export function MaintenanceAlertList({
  alerts,
  variant = 'full',
}: {
  alerts: MaintenanceAlertListItem[];
  variant?: 'full' | 'compact';
}) {
  const t = useTranslations('maintenance');
  const tA = useTranslations('actions');

  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="py-6">
          <EmptyState
            icon={<Check className="h-8 w-8 text-success" />}
            title={t('emptyTitle')}
            description={t('emptyDesc')}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="space-y-2">
      {alerts.map((row) => (
        <AlertRow
          key={row.alert.malId}
          row={row}
          variant={variant}
          t={t}
          tA={tA}
        />
      ))}
    </ul>
  );
}

function AlertRow({
  row,
  variant,
  t,
  tA,
}: {
  row: MaintenanceAlertListItem;
  variant: 'full' | 'compact';
  t: ReturnType<typeof useTranslations>;
  tA: ReturnType<typeof useTranslations>;
}) {
  const [pending, startTransition] = useTransition();
  const a = row.alert;
  const Icon = ALERT_ICON[a.malType];
  const isCritical = a.malSeverity === 'CRITICAL';
  const acknowledged = a.malAcknowledgedAt != null;

  function handleAck() {
    startTransition(async () => {
      const res = await acknowledgeAlertAction({ alert_id: a.malId });
      if (res.success) {
        toast.success(t('toastAcked'));
      } else {
        toast.error(`${res.error.code}: ${res.error.message}`);
      }
    });
  }

  return (
    <li>
      <Card className={acknowledged ? 'opacity-60' : ''}>
        <CardContent className={variant === 'compact' ? 'p-3' : 'p-4'}>
          <div className="flex items-start gap-3">
            <div
              className={
                'h-9 w-9 rounded-md flex items-center justify-center flex-shrink-0 ' +
                (isCritical ? 'bg-danger/15 text-danger' : 'bg-warning/15 text-warning')
              }
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-text">
                  {row.vehiclePlate ?? '—'}
                </span>
                <Badge tone={isCritical ? 'danger' : 'warning'} size="sm">
                  {t(`type_${a.malType}`)}
                </Badge>
              </div>
              <p className="text-xs text-text-muted mt-0.5">{descFor(a, row, t)}</p>
              {acknowledged && row.acknowledgedByName && (
                <p className="text-[11px] text-text-faint mt-1">
                  {t('ackedBy', { name: row.acknowledgedByName })}
                </p>
              )}
            </div>
            {!acknowledged && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleAck}
                disabled={pending}
                iconLeft={<Check />}
              >
                {tA('acknowledge')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

function descFor(
  a: MaintenanceAlertListItem['alert'],
  row: MaintenanceAlertListItem,
  t: ReturnType<typeof useTranslations>,
): string {
  if (a.malType.startsWith('OIL_') && a.malCurrentOdometerKm != null && a.malDueKm != null) {
    return t('descOilKm', {
      current: a.malCurrentOdometerKm.toLocaleString(),
      due: a.malDueKm.toLocaleString(),
    });
  }
  if (a.malType.startsWith('INSPECTION_') && a.malDueAt) {
    return t('descInspectionDate', {
      date: new Date(a.malDueAt).toLocaleDateString('vi-VN'),
    });
  }
  return row.vehicleModel ?? '';
}
