'use client';

import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { Alert, AlertTitle, AlertDescription } from '@car-v2/ui';
import type { ConflictRef, ConflictResult } from '@/server/services/trip-conflict.service';

interface TripConflictBannerProps {
  conflicts: ConflictResult | null;
  loading: boolean;
  /** Compact variant for dialogs — drops the description line. */
  compact?: boolean;
  className?: string;
}

/**
 * Soft-warning banner cho overlap detection (PRD R-1, R-2 R3).
 * Render `null` khi không có conflict — caller không cần điều kiện hoá.
 *
 * Mỗi loại (vehicle / driver) liệt kê tối đa 3 trip; số dư hiện "+N more".
 * Click vào trpRef → mở trip detail trong tab mới (giữ context form hiện tại).
 */
export function TripConflictBanner({ conflicts, loading, compact, className }: TripConflictBannerProps) {
  const t = useTranslations('trips.conflict');

  if (loading) {
    return (
      <Alert variant="neutral" className={className} icon={false}>
        <div className="text-xs text-text-muted animate-pulse">{t('checking')}</div>
      </Alert>
    );
  }

  if (!conflicts) return null;
  const hasVehicle = conflicts.vehicle.length > 0;
  const hasDriver = conflicts.driver.length > 0;
  if (!hasVehicle && !hasDriver) return null;

  return (
    <Alert variant="warning" className={className}>
      <AlertTitle>{t('title')}</AlertTitle>
      {!compact && <AlertDescription>{t('description')}</AlertDescription>}
      <div className="mt-2 space-y-2 text-xs">
        {hasVehicle && <ConflictList label={t('vehicleLabel')} items={conflicts.vehicle} />}
        {hasDriver && <ConflictList label={t('driverLabel')} items={conflicts.driver} />}
      </div>
    </Alert>
  );
}

function ConflictList({ label, items }: { label: string; items: ConflictRef[] }) {
  const t = useTranslations('trips.conflict');
  const f = useFormatter();
  const tStatus = useTranslations('trips.status');
  const visible = items.slice(0, 3);
  const overflow = items.length - visible.length;

  return (
    <div>
      <div className="font-medium text-warning mb-1">{label}</div>
      <ul className="space-y-1">
        {visible.map((c) => (
          <li key={c.trpId} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 leading-snug">
            <Link
              href={`/trips/${c.trpId}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono font-semibold text-warning hover:underline focus-visible:underline focus-visible:outline-none"
            >
              {c.trpRef}
            </Link>
            <span className="text-text-muted">
              {f.dateTime(new Date(c.scheduledAt), {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
              {' · '}
              {t('durationMinutes', { minutes: c.durationMinutes })}
            </span>
            <span className="text-text-faint">· {tStatus(c.status)}</span>
          </li>
        ))}
      </ul>
      {overflow > 0 && (
        <div className="text-text-faint mt-1">{t('andNMore', { count: overflow })}</div>
      )}
    </div>
  );
}
