'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  Check,
  Loader2,
  Play,
  Square,
  UserPlus,
  X,
} from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from '@car-v2/ui';
import type { ActionResult } from '@car-v2/shared/errors';
import type { CarTrip, CarTripStatus } from '@car-v2/db/schema';
import {
  acceptTripAction,
  assignTripAction,
  cancelTripAction,
  endTripAction,
  rejectTripAction,
  startTripAction,
} from '@/server/actions/trips/trip.actions';

interface DriverOption {
  id: string;
  label: string;
}
interface VehicleOption {
  id: string;
  label: string;
}

interface TripActionsProps {
  tripId: string;
  status: CarTripStatus;
  role: 'ADMIN' | 'MANAGER' | 'DRIVER';
  /* Whether the current actor is the assigned driver (drv_user_id === user_id) */
  isAssignedDriver: boolean;
  /* Whether the current actor is the trip creator (used by Manager cancel) */
  isCreator: boolean;
  drivers: DriverOption[];
  vehicles: VehicleOption[];
}

type DialogKind = 'assign' | 'reject' | 'cancel' | null;

export function TripActions({
  tripId,
  status,
  role,
  isAssignedDriver,
  isCreator,
  drivers,
  vehicles,
}: TripActionsProps) {
  const t  = useTranslations('trips.actions');
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<DialogKind>(null);

  const handle = async (label: string, fn: () => Promise<ActionResult<CarTrip>>) => {
    startTransition(async () => {
      const result = await fn();
      if (result.success) {
        toast.success(label, { description: `${t('tStatusPrefix')} ${result.data.trpStatus}` });
      } else {
        toast.error(`${label} ${t('tFailedSuffix')}`, { description: `${result.error.code} — ${result.error.message}` });
      }
    });
  };

  /* Decide which transition buttons are relevant given current status + actor. */
  const canAssign = role === 'ADMIN' && (status === 'PENDING_ASSIGNMENT' || status === 'REJECTED_BY_DRIVER');
  const canAccept = isAssignedDriver && status === 'PENDING_DRIVER_CONFIRMATION';
  const canReject = isAssignedDriver && status === 'PENDING_DRIVER_CONFIRMATION';
  const canStart  = isAssignedDriver && status === 'CONFIRMED';
  const canEnd    = isAssignedDriver && status === 'IN_PROGRESS';
  const canCancel =
    role === 'ADMIN'
      ? status !== 'COMPLETED' && status !== 'CANCELLED'
      : role === 'MANAGER' && isCreator && (status === 'PENDING_ASSIGNMENT' || status === 'PENDING_DRIVER_CONFIRMATION');

  const noActionsAvailable =
    !canAssign && !canAccept && !canReject && !canStart && !canEnd && !canCancel;

  return (
    <>
      {/* Vertical stack so buttons span the rail width — primary action goes
       * first, destructive (Cancel) last, separated by a thin divider. Default
       * `align-items: stretch` on flex-col makes every Button full-width. */}
      <div className="flex flex-col gap-2">
        {canAssign && (
          <Button variant="accent" size="md" iconLeft={<UserPlus />} onClick={() => setDialog('assign')} disabled={pending}>
            {status === 'REJECTED_BY_DRIVER' ? t('reassign') : t('assign')}
          </Button>
        )}
        {canAccept && (
          <Button variant="accent" size="md" iconLeft={pending ? <Loader2 className="animate-spin" /> : <Check />} onClick={() => handle(t('tAccepted'), () => acceptTripAction(tripId))} disabled={pending}>
            {t('accept')}
          </Button>
        )}
        {canReject && (
          <Button variant="danger" size="md" iconLeft={<X />} onClick={() => setDialog('reject')} disabled={pending}>
            {t('reject')}
          </Button>
        )}
        {canStart && (
          <Button variant="accent" size="md" iconLeft={pending ? <Loader2 className="animate-spin" /> : <Play />} onClick={() => handle(t('tStarted'), () => startTripAction(tripId, {}))} disabled={pending}>
            {t('startTrip')}
          </Button>
        )}
        {canEnd && (
          <Button variant="primary" size="md" iconLeft={pending ? <Loader2 className="animate-spin" /> : <Square />} onClick={() => handle(t('tCompleted'), () => endTripAction(tripId, {}))} disabled={pending}>
            {t('endTrip')}
          </Button>
        )}
        {canCancel && (
          <Button variant="ghost" size="md" iconLeft={<X />} onClick={() => setDialog('cancel')} disabled={pending}>
            {t('cancelTrip')}
          </Button>
        )}
        {noActionsAvailable && (
          <span className="text-xs text-text-faint italic text-center py-1">{t('noActions')}</span>
        )}
      </div>

      <AssignDialog
        open={dialog === 'assign'}
        onClose={() => setDialog(null)}
        tripId={tripId}
        drivers={drivers}
        vehicles={vehicles}
        pending={pending}
        onSubmit={(driverId, vehicleId) =>
          handle(status === 'REJECTED_BY_DRIVER' ? t('tReassigned') : t('tAssigned'), () =>
            assignTripAction(tripId, { driver_id: driverId, vehicle_id: vehicleId }),
          )
        }
      />

      <ReasonDialog
        open={dialog === 'reject'}
        onClose={() => setDialog(null)}
        title={t('rejectDialogTitle')}
        description={t('rejectDialogDesc')}
        confirmLabel={t('reject')}
        confirmTone="danger"
        pending={pending}
        onSubmit={(reason) => handle(t('tRejected'), () => rejectTripAction(tripId, { reason }))}
        required
      />

      <ReasonDialog
        open={dialog === 'cancel'}
        onClose={() => setDialog(null)}
        title={t('cancelDialogTitle')}
        description={t('cancelDialogDesc')}
        confirmLabel={t('cancelTrip')}
        confirmTone="danger"
        pending={pending}
        onSubmit={(reason) => handle(t('tCancelled'), () => cancelTripAction(tripId, { reason }))}
      />
    </>
  );
}

/* ─── Sub-dialogs ──────────────────────────────────────────────────────── */

interface AssignDialogProps {
  open: boolean;
  onClose: () => void;
  tripId: string;
  drivers: DriverOption[];
  vehicles: VehicleOption[];
  pending: boolean;
  onSubmit: (driverId: string, vehicleId: string) => void;
}

function AssignDialog({ open, onClose, drivers, vehicles, pending, onSubmit }: AssignDialogProps) {
  const t  = useTranslations('trips.actions');
  const tA = useTranslations('actions');
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const canSubmit = driverId && vehicleId;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('assignDialogTitle')}</DialogTitle>
          <DialogDescription>{t('assignDialogDesc')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 block" required>{t('driverLabel')}</Label>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger><SelectValue placeholder={t('pickDriver')} /></SelectTrigger>
              <SelectContent>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block" required>{t('vehicleLabel')}</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger><SelectValue placeholder={t('pickVehicle')} /></SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{tA('cancel')}</Button>
          <Button
            variant="accent"
            disabled={!canSubmit || pending}
            onClick={() => {
              onSubmit(driverId, vehicleId);
              onClose();
            }}
          >
            {t('sendToDriver')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ReasonDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  confirmTone: 'accent' | 'danger';
  pending: boolean;
  required?: boolean;
  onSubmit: (reason: string) => void;
}

function ReasonDialog({ open, onClose, title, description, confirmLabel, confirmTone, pending, required, onSubmit }: ReasonDialogProps) {
  const t  = useTranslations('trips.actions');
  const tA = useTranslations('actions');
  const [reason, setReason] = useState('');
  const canSubmit = !required || reason.trim().length >= 3;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div>
          <Label className="mb-1.5 block" required={required}>{t('reasonLabel')}</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={required ? t('reasonRequired') : t('reasonOptional')}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{tA('cancel')}</Button>
          <Button
            variant={confirmTone}
            disabled={!canSubmit || pending}
            onClick={() => {
              onSubmit(reason);
              setReason('');
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* Silence unused import warnings for inputs we may bring back in P2. */
void Input;
