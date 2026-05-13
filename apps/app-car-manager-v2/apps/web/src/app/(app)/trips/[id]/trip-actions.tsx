'use client';

import { useState, useTransition } from 'react';
import {
  Check,
  ExternalLink,
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
  googleMapsUrl: string | null;
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
  googleMapsUrl,
}: TripActionsProps) {
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<DialogKind>(null);

  const handle = async (label: string, fn: () => Promise<ActionResult<CarTrip>>) => {
    startTransition(async () => {
      const result = await fn();
      if (result.success) {
        toast.success(label, { description: `Trip status: ${result.data.trpStatus}` });
      } else {
        toast.error(label + ' failed', { description: `${result.error.code} — ${result.error.message}` });
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
      <div className="flex flex-wrap items-center justify-end gap-2">
        {googleMapsUrl && (
          <Button variant="ghost" size="md" iconLeft={<ExternalLink />} asChild>
            <a href={googleMapsUrl} target="_blank" rel="noreferrer">Open in Maps</a>
          </Button>
        )}
        {canAssign && (
          <Button variant="accent" size="md" iconLeft={<UserPlus />} onClick={() => setDialog('assign')} disabled={pending}>
            {status === 'REJECTED_BY_DRIVER' ? 'Reassign' : 'Assign driver'}
          </Button>
        )}
        {canAccept && (
          <Button variant="accent" size="md" iconLeft={pending ? <Loader2 className="animate-spin" /> : <Check />} onClick={() => handle('Trip accepted', () => acceptTripAction(tripId))} disabled={pending}>
            Accept
          </Button>
        )}
        {canReject && (
          <Button variant="danger" size="md" iconLeft={<X />} onClick={() => setDialog('reject')} disabled={pending}>
            Reject
          </Button>
        )}
        {canStart && (
          <Button variant="accent" size="md" iconLeft={pending ? <Loader2 className="animate-spin" /> : <Play />} onClick={() => handle('Trip started', () => startTripAction(tripId, {}))} disabled={pending}>
            Start trip
          </Button>
        )}
        {canEnd && (
          <Button variant="primary" size="md" iconLeft={pending ? <Loader2 className="animate-spin" /> : <Square />} onClick={() => handle('Trip completed', () => endTripAction(tripId, {}))} disabled={pending}>
            End trip
          </Button>
        )}
        {canCancel && (
          <Button variant="ghost" size="md" iconLeft={<X />} onClick={() => setDialog('cancel')} disabled={pending}>
            Cancel trip
          </Button>
        )}
        {noActionsAvailable && (
          <span className="text-xs text-text-faint italic">No actions available for this state.</span>
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
          handle(status === 'REJECTED_BY_DRIVER' ? 'Trip reassigned' : 'Driver assigned', () =>
            assignTripAction(tripId, { driver_id: driverId, vehicle_id: vehicleId }),
          )
        }
      />

      <ReasonDialog
        open={dialog === 'reject'}
        onClose={() => setDialog(null)}
        title="Reject trip"
        description="Tell the dispatcher why you can't take this trip."
        confirmLabel="Reject trip"
        confirmTone="danger"
        pending={pending}
        onSubmit={(reason) => handle('Trip rejected', () => rejectTripAction(tripId, { reason }))}
        required
      />

      <ReasonDialog
        open={dialog === 'cancel'}
        onClose={() => setDialog(null)}
        title="Cancel trip"
        description="Provide a short reason. The driver will be notified."
        confirmLabel="Cancel trip"
        confirmTone="danger"
        pending={pending}
        onSubmit={(reason) => handle('Trip cancelled', () => cancelTripAction(tripId, { reason }))}
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
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const canSubmit = driverId && vehicleId;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign driver + vehicle</DialogTitle>
          <DialogDescription>Both fields are required to send the trip to the driver.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 block" required>Driver</Label>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger><SelectValue placeholder="Pick a driver" /></SelectTrigger>
              <SelectContent>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block" required>Vehicle</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger><SelectValue placeholder="Pick a vehicle" /></SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="accent"
            disabled={!canSubmit || pending}
            onClick={() => {
              onSubmit(driverId, vehicleId);
              onClose();
            }}
          >
            Send to driver
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
          <Label className="mb-1.5 block" required={required}>Reason</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={required ? 'Min 3 characters' : 'Optional'}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
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
