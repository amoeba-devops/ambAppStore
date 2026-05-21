'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Ban, Loader2, Plus, Save } from 'lucide-react';
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
import type { CarTrip } from '@car-v2/db/schema';
import type { LocalRole } from '@car-v2/shared/auth';
import { AddressAutocomplete } from '@/components/inputs/address-autocomplete';
import { DraftRestoreBanner } from '@/components/forms/draft-restore-banner';
import { FormField, FormSection } from '@/components/forms/form-section';
import { MapPreview } from '@/components/inputs/map-preview';
import { useFormDraft } from '@/hooks/use-form-draft';
import { fromMinutes, toMinutes, type DurationUnit } from '@/lib/duration';
import { formatActionError } from '@/lib/format-action-error';
import { cancelTripAction, updateTripAction } from '@/server/actions/trips/trip.actions';

interface EditTripDraftValues {
  passengerId: string;
  pickup: string;
  dropoff: string;
  scheduledAt: string;
  durationValue: string;
  durationUnit: DurationUnit;
  purpose: string;
  notes: string;
}

interface SelectOption {
  id: string;
  label: string;
}

interface EditTripFormProps {
  trip: CarTrip;
  passengers: SelectOption[];
  role: LocalRole;
}

function isoToLocalInput(iso: Date | string): string {
  /* datetime-local expects "YYYY-MM-DDTHH:mm". Use local time. */
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditTripForm({ trip, passengers, role }: EditTripFormProps) {
  const t  = useTranslations('trips.form');
  const tA = useTranslations('actions');
  const tErr = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  /* Manager cannot change passenger after creation (PRD FR-1.3). */
  const passengerLocked = role === 'MANAGER';

  const [passengerId, setPassengerId] = useState(trip.trpPassengerId ?? '');
  const [pickup, setPickup] = useState(trip.trpPickupAddress);
  const [dropoff, setDropoff] = useState(trip.trpDropoffAddress);
  const [scheduledAt, setScheduledAt] = useState(isoToLocalInput(trip.trpScheduledAt));
  const initialDuration = fromMinutes(trip.trpDurationMinutes);
  const [durationValue, setDurationValue] = useState<string>(initialDuration.value);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>(initialDuration.unit);
  const [purpose, setPurpose] = useState(trip.trpPurpose ?? '');
  const [notes, setNotes] = useState(trip.trpNotes ?? '');

  /* Draft persistence — keyed by trip ID so each trip has its own draft and
   * concurrent edits on multiple trips don't collide. */
  const draftValues: EditTripDraftValues = {
    passengerId,
    pickup,
    dropoff,
    scheduledAt,
    durationValue,
    durationUnit,
    purpose,
    notes,
  };
  const editSecondary = `${trip.trpPickupAddress.slice(0, 28)} → ${trip.trpDropoffAddress.slice(0, 28)}`;
  const { draft, clearDraft, dismissDraft } = useFormDraft<EditTripDraftValues>({
    key: `trip:edit:${trip.trpId}`,
    values: draftValues,
    label: {
      primary: t('draftLabelEdit', { ref: trip.trpRef }),
      secondary: editSecondary,
    },
    href: `/trips/${trip.trpId}/edit`,
    entity: 'trip',
  });

  const handleRestoreDraft = () => {
    if (!draft) return;
    const v = draft.values;
    if (!passengerLocked) setPassengerId(v.passengerId);
    setPickup(v.pickup);
    setDropoff(v.dropoff);
    setScheduledAt(v.scheduledAt);
    setDurationValue(v.durationValue);
    setDurationUnit(v.durationUnit);
    setPurpose(v.purpose);
    setNotes(v.notes);
    dismissDraft();
  };

  const onSubmit = () => {
    /* Guard against double-submit (Enter + click race). */
    if (pending) return;
    if (!pickup.trim() || !dropoff.trim() || !scheduledAt) {
      toast.error(t('errMissing'), { description: t('errMissingDesc') });
      return;
    }

    startTransition(async () => {
      const result = await updateTripAction(trip.trpId, {
        passenger_id: passengerLocked ? undefined : passengerId || undefined,
        pickup_address: pickup.trim(),
        dropoff_address: dropoff.trim(),
        scheduled_at: new Date(scheduledAt).toISOString(),
        duration_minutes: toMinutes(durationValue, durationUnit) ?? null,
        purpose: purpose.trim() || null,
        notes: notes.trim() || null,
      });
      if (result.success) {
        clearDraft();
        const routeSummary = `${pickup.trim()} → ${dropoff.trim()}`;
        toast.success(t('tUpdated', { ref: result.data.trpRef }), {
          description: routeSummary,
        });
        /* Land on All-trips with this row highlighted — same UX as Create. */
        router.push(`/trips?status=all&highlight=${trip.trpId}`);
      } else {
        toast.error(t('errUpdate'), { description: formatActionError(result.error, tErr) });
      }
    });
  };

  /* ── Cancel-trip flow ──
   * Available whenever the trip isn't already CANCELLED. State-machine /
   * role rules are enforced server-side by `cancelTripAction`; this UI only
   * surfaces the destructive action when it makes sense. */
  const tActionsNs = useTranslations('trips.actions');
  const canCancelTrip = trip.trpStatus !== 'CANCELLED';
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, startCancelTransition] = useTransition();

  const handleCancelTrip = () => {
    if (cancelling) return;
    startCancelTransition(async () => {
      const result = await cancelTripAction(trip.trpId, {
        reason: cancelReason.trim() || undefined,
      });
      if (result.success) {
        clearDraft();
        toast.success(tActionsNs('tCancelled'), { description: trip.trpRef });
        setCancelDialogOpen(false);
        router.push(`/trips?status=all&highlight=${trip.trpId}`);
      } else {
        toast.error(`${tActionsNs('cancelTrip')} ${tActionsNs('tFailedSuffix')}`, {
          description: formatActionError(result.error, tErr),
        });
      }
    });
  };

  /* Notes disclosure state — auto-expand if existing trip already has notes
   * (most edit sessions do) so the field is immediately visible. */
  const [notesExpanded, setNotesExpanded] = useState(!!notes);
  useEffect(() => {
    if (notes && !notesExpanded) setNotesExpanded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  return (
    <form
      /* Same compact full-height pattern as the new-trip form: Route lives at
       * full width above a 2-col grid that puts Time/Passenger on the left
       * and a sticky map on the right. overflow-x-hidden everywhere prevents
       * any descendant (datetime widget, select option text) from triggering
       * a page-level horizontal scrollbar. */
      className="lg:h-full lg:max-w-[1100px] mx-auto lg:flex lg:flex-col overflow-x-hidden"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {draft && (
        <DraftRestoreBanner
          savedAt={draft.savedAt}
          onRestore={handleRestoreDraft}
          onDiscard={clearDraft}
          className="mb-4 lg:mb-3"
        />
      )}

      {/* Route — full width above the grid. */}
      <div className="lg:shrink-0 lg:mb-4 min-w-0 overflow-x-hidden">
        <FormSection label={t('sectionRoute')} required>
          <div className="space-y-2.5">
            <FormField label={t('pickup')} required inline>
              <AddressAutocomplete value={pickup} onChange={(val) => setPickup(val)} maxLength={2000} />
            </FormField>
            <FormField label={t('dropoff')} required inline>
              <AddressAutocomplete value={dropoff} onChange={(val) => setDropoff(val)} maxLength={2000} />
            </FormField>
          </div>
        </FormSection>
      </div>

      <div className="lg:flex-1 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] lg:gap-5 lg:overflow-hidden">
        {/* Left column — Time, Passenger, then footer. */}
        <div className="min-w-0 overflow-x-hidden space-y-4 lg:space-y-3.5 lg:overflow-y-auto lg:pr-2">

          {/* ── TIME ── side-by-side: datetime flexible + duration 190px fixed. */}
          <FormSection label={t('sectionTime')} required>
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_190px] gap-2.5 md:items-end">
              <FormField label={t('scheduledAt')} required inline className="min-w-0">
                <Input
                  type="datetime-local"
                  step={900}
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full min-w-0"
                />
              </FormField>
              <FormField label={t('duration')} inline className="min-w-0">
                <div className="flex gap-2 min-w-0">
                  <Input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={durationValue}
                    onChange={(e) => setDurationValue(e.target.value)}
                    placeholder={t('durationValuePlaceholder')}
                    className="w-16 shrink-0"
                  />
                  <Select value={durationUnit} onValueChange={(v) => setDurationUnit(v as DurationUnit)}>
                    <SelectTrigger className="flex-1 min-w-0"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">{t('unitMinutes')}</SelectItem>
                      <SelectItem value="hours">{t('unitHours')}</SelectItem>
                      <SelectItem value="days">{t('unitDays')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </FormField>
            </div>
          </FormSection>

          {/* ── PASSENGER & PURPOSE — with collapsible Notes ── */}
          <FormSection label={t('sectionPassenger')}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <FormField
                label={t('passenger')}
                inline
                className="min-w-0"
                hint={passengerLocked ? t('passengerLockHint') : undefined}
              >
                <Select value={passengerId} onValueChange={setPassengerId} disabled={passengerLocked}>
                  <SelectTrigger className="w-full min-w-0"><SelectValue placeholder={t('passengerPlaceholder')} /></SelectTrigger>
                  <SelectContent>
                    {passengers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label={t('purpose')} inline className="min-w-0">
                <Input
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder={t('purposePlaceholderEdit')}
                  maxLength={255}
                  className="w-full"
                />
              </FormField>
            </div>
            {notesExpanded ? (
              <div className="mt-2.5">
                <Label className="mb-1 block text-xs">{t('notes')}</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('notesPlaceholder')}
                  rows={2}
                  maxLength={2000}
                />
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                iconLeft={<Plus />}
                onClick={() => setNotesExpanded(true)}
                className="h-7 px-2 mt-2 text-xs"
              >
                {t('addNotes')}
              </Button>
            )}
          </FormSection>

          {/* Mobile-only inline map. */}
          <div className="lg:hidden">
            <MapPreview pickup={pickup} dropoff={dropoff} />
          </div>

          {/* Footer — sticky on mobile, inline on desktop. md:mx-0 cancels the
           * mobile -mx-4 bleed so overflow-x-hidden doesn't clip the buttons.
           * "Huỷ chuyến" is destructive — left-aligned (mr-auto) on desktop to
           * separate visually from the primary Cancel/Save group on the right. */}
          <div className="md:flex md:justify-end md:gap-2 md:items-center md:pt-2 md:static md:bg-transparent md:px-0 md:py-0 md:border-t-0 md:mx-0
            sticky bottom-0 -mx-4 px-4 py-3 bg-bg/95 backdrop-blur border-t border-border flex flex-wrap gap-2">
            {canCancelTrip && (
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => setCancelDialogOpen(true)}
                iconLeft={<Ban />}
                disabled={cancelling}
                className="text-danger hover:text-danger hover:bg-danger-soft w-full md:w-auto md:mr-auto order-last md:order-first"
              >
                {tActionsNs('cancelTrip')}
              </Button>
            )}
            <Button type="button" variant="secondary" size="lg" className="flex-1 md:flex-initial" asChild>
              <Link href={`/trips/${trip.trpId}`}>{tA('cancel')}</Link>
            </Button>
            <Button type="submit" variant="accent" size="lg" className="flex-1 md:flex-initial" disabled={pending}
              iconLeft={pending ? <Loader2 className="animate-spin" /> : <Save />}>
              {pending ? t('submitSaving') : t('submitSave')}
            </Button>
          </div>
        </div>
        {/* end left column */}

        {/* Right column — desktop-only sticky map. */}
        <aside className="hidden lg:flex lg:flex-col lg:h-full">
          <MapPreview
            pickup={pickup}
            dropoff={dropoff}
            heightClassName="h-full min-h-[300px]"
            showFullscreenLink
            className="flex-1 flex flex-col [&>div:last-child]:flex-1"
          />
        </aside>
      </div>

      {/* Cancel-trip confirmation dialog. Renders outside the form's visual
       * area but stays inside <form> so submitting reason still uses the form
       * context — though we call cancelTripAction directly, not via submit. */}
      <Dialog open={cancelDialogOpen} onOpenChange={(o) => !o && !cancelling && setCancelDialogOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tActionsNs('cancelDialogTitle')}</DialogTitle>
            <DialogDescription>{tActionsNs('cancelDialogDesc')}</DialogDescription>
          </DialogHeader>
          <div>
            <Label className="mb-1.5 block">{tActionsNs('reasonLabel')}</Label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder={tActionsNs('reasonOptional')}
              rows={3}
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCancelDialogOpen(false)}
              disabled={cancelling}
            >
              {tA('cancel')}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleCancelTrip}
              disabled={cancelling}
              iconLeft={cancelling ? <Loader2 className="animate-spin" /> : <Ban />}
            >
              {tActionsNs('cancelTrip')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
