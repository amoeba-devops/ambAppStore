'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
  toast,
} from '@car-v2/ui';
import { formatActionError } from '@/lib/format-action-error';
import { cancelTripAction, endTripAction } from '@/server/actions/trips/trip.actions';
import type { ConflictRef, ConflictResult } from '@/server/services/trip-conflict.service';

interface TripConflictBannerProps {
  conflicts: ConflictResult | null;
  loading: boolean;
  /** Refetch after admin resolves one of the conflicts (end / cancel old trip). */
  refetch?: () => void;
  /** Compact variant for dialogs — drops the description line. */
  compact?: boolean;
  className?: string;
}

/**
 * Soft-warning banner cho overlap detection (PRD R-1, R-2 R3) — interactive.
 *
 * Mỗi conflict row có 2 action button cho admin xử lý ngay tại chỗ:
 *   - "Hoàn tất" — chỉ hiện khi old trip ∈ {CONFIRMED, IN_PROGRESS}; gọi
 *     endTripAction (Admin có quyền override per state machine).
 *   - "Huỷ chuyến" — luôn available; mở dialog hỏi lý do (pre-fill "Thay
 *     bằng chuyến mới"), gọi cancelTripAction.
 * Sau khi resolve thành công → refetch() → banner re-render bỏ trip đó khỏi
 * list. Khi banner empty → admin save trip mới mà không cần override.
 *
 * Còn lại "Mở chi tiết" — link tab mới để admin review trước khi action.
 */
export function TripConflictBanner({
  conflicts,
  loading,
  refetch,
  compact,
  className,
}: TripConflictBannerProps) {
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
      <div className="mt-2 space-y-3 text-xs">
        {hasVehicle && (
          <ConflictList label={t('vehicleLabel')} items={conflicts.vehicle} refetch={refetch} />
        )}
        {hasDriver && (
          <ConflictList label={t('driverLabel')} items={conflicts.driver} refetch={refetch} />
        )}
      </div>
    </Alert>
  );
}

function ConflictList({
  label,
  items,
  refetch,
}: {
  label: string;
  items: ConflictRef[];
  refetch?: () => void;
}) {
  const t = useTranslations('trips.conflict');
  const visible = items.slice(0, 3);
  const overflow = items.length - visible.length;

  return (
    <div>
      <div className="font-medium text-warning mb-1.5">{label}</div>
      <ul className="space-y-2">
        {visible.map((c) => (
          <li key={c.trpId}>
            <ConflictRow item={c} refetch={refetch} />
          </li>
        ))}
      </ul>
      {overflow > 0 && (
        <div className="text-text-faint mt-1.5">{t('andNMore', { count: overflow })}</div>
      )}
    </div>
  );
}

function ConflictRow({ item, refetch }: { item: ConflictRef; refetch?: () => void }) {
  const t = useTranslations('trips.conflict');
  const tErr = useTranslations();
  const tStatus = useTranslations('trips.status');
  const f = useFormatter();
  const [pending, startTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);

  /* "Hoàn tất" only relevant when the conflicting trip is in a state that
   * supports `end` (CONFIRMED → if driver hasn't started yet, Admin can fast-
   * forward; IN_PROGRESS → standard end). PENDING_DRIVER_CONFIRMATION cannot
   * be completed — only cancelled. */
  const canEnd = item.status === 'CONFIRMED' || item.status === 'IN_PROGRESS';

  const handleEnd = () => {
    if (!confirm(t('confirmEnd', { ref: item.trpRef }))) return;
    startTransition(async () => {
      const result = await endTripAction(item.trpId, {});
      if (result.success) {
        toast.success(t('tEndedShort', { ref: item.trpRef }));
        refetch?.();
      } else {
        toast.error(t('tEndedFailed'), { description: formatActionError(result.error, tErr) });
      }
    });
  };

  return (
    <>
      <div className="rounded border border-warning/30 bg-warning-soft/40 px-2.5 py-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 leading-snug">
          <Link
            href={`/trips/${item.trpId}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono font-semibold text-warning hover:underline focus-visible:underline focus-visible:outline-none"
          >
            {item.trpRef}
          </Link>
          <span className="text-text-muted">
            {f.dateTime(new Date(item.scheduledAt), {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
            {' · '}
            {t('durationMinutes', { minutes: item.durationMinutes })}
          </span>
          <span className="text-text-faint">· {tStatus(item.status)}</span>
        </div>
        {(item.pickupAddress || item.dropoffAddress) && (
          <div className="mt-0.5 text-text-faint truncate">
            {item.pickupAddress} → {item.dropoffAddress}
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {canEnd && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              iconLeft={pending ? <Loader2 className="animate-spin" /> : undefined}
              onClick={handleEnd}
              className="h-7 px-2 text-[11px]"
            >
              {t('actionEnd')}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => setCancelOpen(true)}
            className="h-7 px-2 text-[11px]"
          >
            {t('actionCancel')}
          </Button>
          <Button
            type="button"
            asChild
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px]"
          >
            <Link href={`/trips/${item.trpId}`} target="_blank" rel="noreferrer">
              {t('actionView')}
            </Link>
          </Button>
        </div>
      </div>

      <CancelDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        tripRef={item.trpRef}
        tripId={item.trpId}
        onResolved={refetch}
      />
    </>
  );
}

function CancelDialog({
  open,
  onClose,
  tripRef,
  tripId,
  onResolved,
}: {
  open: boolean;
  onClose: () => void;
  tripRef: string;
  tripId: string;
  onResolved?: () => void;
}) {
  const t = useTranslations('trips.conflict');
  const tA = useTranslations('actions');
  const tErr = useTranslations();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState(t('cancelReasonDefault'));

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await cancelTripAction(tripId, { reason: reason.trim() || undefined });
      if (result.success) {
        toast.success(t('tCancelledShort', { ref: tripRef }));
        onResolved?.();
        onClose();
      } else {
        toast.error(t('tCancelledFailed'), { description: formatActionError(result.error, tErr) });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('cancelDialogTitle', { ref: tripRef })}</DialogTitle>
          <DialogDescription>{t('cancelDialogDesc')}</DialogDescription>
        </DialogHeader>
        <div>
          <Label className="mb-1.5 block">{t('cancelReasonLabel')}</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('cancelReasonPlaceholder')}
            rows={3}
            maxLength={500}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {tA('cancel')}
          </Button>
          <Button
            variant="danger"
            disabled={pending}
            iconLeft={pending ? <Loader2 className="animate-spin" /> : undefined}
            onClick={handleConfirm}
          >
            {t('cancelDialogConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
