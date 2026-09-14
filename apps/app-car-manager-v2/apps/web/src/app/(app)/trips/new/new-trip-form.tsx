'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Plus, Save, UserPlus, X } from 'lucide-react';
import {
  Avatar,
  Button,
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
import { FormField, FormSection } from '@/components/forms/form-section';
import { AddressAutocomplete } from '@/components/inputs/address-autocomplete';
import { DraftRestoreBanner } from '@/components/forms/draft-restore-banner';
import { MapPreview } from '@/components/inputs/map-preview';
import { GuardConfirmDialog, useGuardConfirm } from '@/components/dialogs/guard-confirm-dialog';
import { useFormDraft } from '@/hooks/use-form-draft';
import { toMinutes, type DurationUnit } from '@/lib/duration';
import { formatActionError } from '@/lib/format-action-error';
import { createTripAction } from '@/server/actions/trips/trip.actions';

interface TripDraftValues {
  passengerId: string;
  pickup: string;
  dropoff: string;
  scheduledAt: string;
  durationValue: string;
  durationUnit: DurationUnit;
  purpose: string;
  notes: string;
  driverId: string;
  vehicleId: string;
  stopovers: string[];
}

interface SelectOption {
  id: string;
  label: string;
}

interface PassengerOption {
  id: string;
  /** Display name. Có thể null nếu user chưa cập nhật (fallback sang email/id). */
  name: string | null;
  email: string | null;
}

interface NewTripFormProps {
  passengers: PassengerOption[];
  drivers: SelectOption[];
  vehicles: SelectOption[];
  currentUserId: string;
  /** True nếu actor đủ quyền vào /users/new, /drivers/new, /vehicles/new
   *  (theo redirect rules — chỉ ADMIN). MANAGER thấy hint thay vì button. */
  canCreateEntities: boolean;
}

export function NewTripForm({
  passengers,
  drivers,
  vehicles,
  currentUserId,
  canCreateEntities,
}: NewTripFormProps) {
  const t  = useTranslations('trips.form');
  const tA = useTranslations('actions');
  const tErr = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const guard = useGuardConfirm();

  const [passengerId, setPassengerId] = useState(currentUserId);
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [durationValue, setDurationValue] = useState<string>('');
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('hours');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [driverId, setDriverId] = useState<string>('');
  const [vehicleId, setVehicleId] = useState<string>('');
  const [stopovers, setStopovers] = useState<string[]>([]);
  /* Per-field error flags. Set on failed submit, cleared as user types. */
  const [fieldErrors, setFieldErrors] = useState<{ pickup?: boolean; dropoff?: boolean; scheduledAt?: boolean; driver?: boolean; vehicle?: boolean }>({});
  /* Track whether user has made any changes — draft is only saved when dirty. */
  const [isDirty, setIsDirty] = useState(false);
  const markDirty = () => setIsDirty(true);

  /* Auto-persist form state. Restore offer shown via banner on mount if a
   * non-stale draft exists. Cleared on successful submit (router.push fires
   * after `clearDraft()` so the next visit to /trips/new is clean). */
  const draftValues: TripDraftValues = {
    passengerId,
    pickup,
    dropoff,
    scheduledAt,
    durationValue,
    durationUnit,
    purpose,
    notes,
    driverId,
    vehicleId,
    stopovers,
  };
  /* Sidebar label — primary is action-oriented ("Đang đặt chuyến"), secondary
   * shows the route snippet the user typed so they can recognise the draft. */
  const pickupSnip = pickup.trim().slice(0, 28);
  const dropoffSnip = dropoff.trim().slice(0, 28);
  const draftSecondary =
    pickupSnip && dropoffSnip ? `${pickupSnip} → ${dropoffSnip}` :
    pickupSnip ? pickupSnip :
    dropoffSnip ? `→ ${dropoffSnip}` :
    undefined;
  const { draft, clearDraft, dismissDraft } = useFormDraft<TripDraftValues>({
    key: 'trip:new',
    values: draftValues,
    label: { primary: t('draftLabelNew'), secondary: draftSecondary },
    href: '/trips/new',
    entity: 'trip',
    isDirty,
  });

  const handleRestoreDraft = () => {
    if (!draft) return;
    const v = draft.values;
    setPassengerId(v.passengerId || currentUserId);
    setPickup(v.pickup);
    setDropoff(v.dropoff);
    setScheduledAt(v.scheduledAt);
    setDurationValue(v.durationValue);
    setDurationUnit(v.durationUnit);
    setPurpose(v.purpose);
    setNotes(v.notes);
    setDriverId(v.driverId);
    setVehicleId(v.vehicleId);
    setStopovers(v.stopovers);
    setIsDirty(true); // Restored draft should be persisted
    dismissDraft();
  };

  const addStopover = () => {
    if (stopovers.length >= 10) return;
    setStopovers((s) => [...s, '']);
    markDirty();
  };
  const removeStopover = (i: number) => {
    setStopovers((s) => s.filter((_, idx) => idx !== i));
    markDirty();
  };
  const updateStopover = (i: number, value: string) => {
    setStopovers((s) => s.map((v, idx) => (idx === i ? value : v)));
    markDirty();
  };

  const onSubmit = (confirmedCodes?: string[]) => {
    /* Guard against double-submit: Enter key + click race, useTransition
     * pending flag re-renders may still leave a 1-frame window. Bailing
     * here is cheaper than the createTripAction work that follows. */
    if (pending) return;

    const missing = {
      pickup: !pickup.trim(),
      dropoff: !dropoff.trim(),
      scheduledAt: !scheduledAt,
    };
    if (missing.pickup || missing.dropoff || missing.scheduledAt) {
      setFieldErrors((prev) => ({ ...prev, ...missing }));
      toast.error(t('errMissing'), { description: t('errMissingDesc') });
      return;
    }
    /* Validate assignment is all-or-nothing on client to give early feedback. */
    if ((driverId && !vehicleId) || (!driverId && vehicleId)) {
      setFieldErrors((prev) => ({ ...prev, driver: !driverId, vehicle: !vehicleId }));
      toast.error(t('errIncomplete'), { description: t('errIncompleteDesc') });
      return;
    }
    setFieldErrors({});

    startTransition(async () => {
      const scheduledIsoSubmit = new Date(scheduledAt).toISOString();
      const result = await createTripAction({
        passenger_id: passengerId || undefined,
        pickup_address: pickup.trim(),
        dropoff_address: dropoff.trim(),
        scheduled_at: scheduledIsoSubmit,
        duration_minutes: toMinutes(durationValue, durationUnit),
        purpose: purpose.trim() || undefined,
        notes: notes.trim() || undefined,
        driver_id: driverId || undefined,
        vehicle_id: vehicleId || undefined,
        stopovers: stopovers.filter((s) => s.trim()).map((s) => s.trim()),
        confirmed_warning_codes: confirmedCodes,
      });
      if (result.success) {
        clearDraft();
        /* Friendly toast: lead with the trip ref then a brief route summary
         * so the user sees what they just booked, not just an opaque code. */
        const routeSummary = `${pickup.trim()} → ${dropoff.trim()}`;
        toast.success(t('tCreated', { ref: result.data.trpRef }), {
          description: routeSummary,
        });
        /* Land on the All-trips list with this trip highlighted so the user
         * can confirm it appears in the queue. The detail page is one click
         * away from there, and the highlight ring fades after ~3s. */
        router.push(`/trips?status=all&highlight=${result.data.trpId}`);
      } else if (!guard.intercept(result.error, (codes) => onSubmit(codes))) {
        toast.error(t('errCreate'), { description: formatActionError(result.error, tErr) });
      }
    });
  };

  return (
    <form
      /* Layout strategy:
       *   Mobile: single column, page-level vertical scroll.
       *   Desktop (lg+): 2-col grid filling the parent's available height.
       *     - Left column scrolls internally (form fields)
       *     - Right column is sticky map at full column height
       *   The form itself uses h-full so the inner grid can claim viewport height
       *   without page-level scroll. */
      /* `overflow-x-hidden` is a safety net: any descendant that escapes its
       * column (datetime-local native widget min-width, long select options,
       * etc) is clipped here instead of forcing a page-level horizontal
       * scroll. The grid columns already use `minmax(0, 1fr)` to allow
       * shrinking; this just guarantees the floor. */
      className="lg:h-full lg:max-w-[1100px] mx-auto lg:flex lg:flex-col overflow-x-hidden"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      aria-label={t('createAria')}
    >
      {draft && (
        <DraftRestoreBanner
          savedAt={draft.savedAt}
          onRestore={handleRestoreDraft}
          onDiscard={clearDraft}
          className="mb-4 lg:mb-3"
        />
      )}

      {/* Route section spans the full form width above the 2-col grid so the
       * pickup/dropoff inputs (which often hold long Vietnamese addresses) get
       * the entire form's horizontal real estate. `shrink-0` keeps it pinned
       * at fixed height — the grid below absorbs leftover height instead. */}
      <div className="lg:shrink-0 lg:mb-4 min-w-0 overflow-x-hidden">
        <FormSection label={t('sectionRoute')} required>
          <div className="space-y-2.5">
            <FormField label={t('pickup')} required error={fieldErrors.pickup} inline>
              <AddressAutocomplete
                value={pickup}
                onChange={(val) => {
                  setPickup(val);
                  markDirty();
                  if (fieldErrors.pickup && val.trim()) setFieldErrors((p) => ({ ...p, pickup: false }));
                }}
                error={fieldErrors.pickup}
                placeholder={t('pickupPlaceholder')}
                maxLength={2000}
              />
            </FormField>
            <FormField label={t('dropoff')} required error={fieldErrors.dropoff} inline>
              <AddressAutocomplete
                value={dropoff}
                onChange={(val) => {
                  setDropoff(val);
                  markDirty();
                  if (fieldErrors.dropoff && val.trim()) setFieldErrors((p) => ({ ...p, dropoff: false }));
                }}
                error={fieldErrors.dropoff}
                placeholder={t('dropoffPlaceholder')}
                maxLength={2000}
              />
            </FormField>
            {stopovers.length > 0 && (
              <ul className="space-y-1.5">
                {stopovers.map((s, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <div className="flex-1">
                      <AddressAutocomplete
                        value={s}
                        onChange={(val) => updateStopover(i, val)}
                        placeholder={t('stopPlaceholder', { n: i + 1 })}
                        maxLength={2000}
                      />
                    </div>
                    <Button type="button" variant="ghost" size="icon" aria-label={t('removeStopAria')} onClick={() => removeStopover(i)}>
                      <X />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {stopovers.length < 10 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                iconLeft={<Plus />}
                onClick={addStopover}
                className="h-7 px-2 text-xs"
              >
                {t('addStop')}{stopovers.length > 0 ? ` (${stopovers.length}/10)` : ''}
              </Button>
            )}
          </div>
        </FormSection>
      </div>

      <div className="lg:flex-1 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] lg:gap-5 lg:overflow-hidden">
        {/* Left column — flat compact form (Route already lives above this
         * grid, so this column only carries Time + Passenger + Assignment).
         * `min-w-0` is critical: without it, grid children default to
         * min-width: auto and expand to fit content (datetime-local widget,
         * long select option text) → horizontal overflow → page scroll-x.
         * Adding `overflow-x-hidden` belt-and-suspenders: even if a deeper
         * descendant insists on its intrinsic min-width, it gets clipped here
         * rather than escaping to the page. */}
        <div className="min-w-0 overflow-x-hidden space-y-4 lg:space-y-3.5 lg:overflow-y-auto lg:pr-2">

          {/* ── TIME ──
           * Side-by-side: datetime takes 1fr (flexible), duration takes a fixed
           * 190px column. The `minmax(0, 1fr)` lets the datetime cell shrink
           * past its intrinsic content width (datetime-local native widget min
           * ~200px); the surrounding overflow-x-hidden chain clips any visual
           * overflow rather than expanding the column. */}
          <FormSection label={t('sectionTime')} required>
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_190px] gap-2.5 md:items-end">
              <FormField label={t('scheduledAt')} required error={fieldErrors.scheduledAt} inline className="min-w-0">
                <Input
                  type="datetime-local"
                  step={900}
                  value={scheduledAt}
                  onChange={(e) => {
                    setScheduledAt(e.target.value);
                    markDirty();
                    if (fieldErrors.scheduledAt && e.target.value) setFieldErrors((p) => ({ ...p, scheduledAt: false }));
                  }}
                  error={fieldErrors.scheduledAt}
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
                    onChange={(e) => { setDurationValue(e.target.value); markDirty(); }}
                    placeholder={t('durationValuePlaceholder')}
                    className="w-16 shrink-0"
                  />
                  <Select value={durationUnit} onValueChange={(v) => { setDurationUnit(v as DurationUnit); markDirty(); }}>
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
              <FormField label={t('passenger')} inline className="min-w-0">
                {passengers.length === 0 ? (
                  <PassengerEmptyState
                    canInvite={canCreateEntities}
                    labels={{
                      empty: t('passengerEmpty'),
                      hint: t('passengerEmptyHint'),
                      invite: t('passengerInvite'),
                      contactAdmin: t('passengerContactAdmin'),
                    }}
                  />
                ) : (
                  <Select value={passengerId} onValueChange={(v) => { setPassengerId(v); markDirty(); }}>
                    <SelectTrigger className="w-full min-w-0 h-auto py-1.5">
                      <SelectValue placeholder={t('passengerPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {passengers.map((p) => {
                        const displayName = p.name?.trim() || p.email?.split('@')[0] || p.id;
                        return (
                          <SelectItem key={p.id} value={p.id}>
                            <PassengerOptionRow name={displayName} email={p.email} />
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
              <FormField label={t('purpose')} inline className="min-w-0">
                <Input
                  value={purpose}
                  onChange={(e) => { setPurpose(e.target.value); markDirty(); }}
                  placeholder={t('purposePlaceholder')}
                  maxLength={255}
                  className="w-full"
                />
              </FormField>
            </div>
            <NotesDisclosure
              notes={notes}
              setNotes={(v) => { setNotes(v); markDirty(); }}
              labelOpen={t('addNotes')}
              labelField={t('notes')}
              placeholder={t('notesPlaceholder')}
            />
          </FormSection>

          {/* ── ASSIGNMENT (optional) ── */}
          <FormSection label={t('sectionAssignment')} hint={t('sectionAssignmentDescShort')}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <FormField label={t('driver')} error={fieldErrors.driver} inline className="min-w-0">
                <AssignmentSelect
                  value={driverId}
                  onChange={(v) => {
                    setDriverId(v);
                    markDirty();
                    if (fieldErrors.driver && v) setFieldErrors((p) => ({ ...p, driver: false }));
                  }}
                  placeholder={t('driverPlaceholder')}
                  options={drivers}
                  error={fieldErrors.driver}
                  createHref="/drivers/new"
                  createLabel={t('createNewDriver')}
                  emptyLabel={t('driverEmpty')}
                  emptyHint={t('driverEmptyHint')}
                  contactAdminLabel={t('contactAdminCreate')}
                  canCreate={canCreateEntities}
                />
              </FormField>
              <FormField label={t('vehicle')} error={fieldErrors.vehicle} inline className="min-w-0">
                <AssignmentSelect
                  value={vehicleId}
                  onChange={(v) => {
                    setVehicleId(v);
                    markDirty();
                    if (fieldErrors.vehicle && v) setFieldErrors((p) => ({ ...p, vehicle: false }));
                  }}
                  placeholder={t('vehiclePlaceholder')}
                  options={vehicles}
                  error={fieldErrors.vehicle}
                  createHref="/vehicles/new"
                  createLabel={t('createNewVehicle')}
                  emptyLabel={t('vehicleEmpty')}
                  emptyHint={t('vehicleEmptyHint')}
                  contactAdminLabel={t('contactAdminCreate')}
                  canCreate={canCreateEntities}
                />
              </FormField>
            </div>
          </FormSection>

          {/* Mobile-only inline map. Desktop has its own sticky map column. */}
          <div className="lg:hidden">
            <MapPreview pickup={pickup} dropoff={dropoff} stopovers={stopovers} />
          </div>

          {/* Footer buttons — placed below the Assignment section in the left
           * column. Mobile keeps the sticky-bottom treatment so they remain
           * reachable while scrolling a long page; desktop is inline since
           * no scroll is expected on a typical viewport.
           *
           * Important: the mobile `-mx-4` (bleed sticky bar to viewport edges)
           * MUST be cancelled on desktop via `md:mx-0`. Otherwise the negative
           * margin extends the footer 16px past its column edge, and the
           * surrounding overflow-x-hidden clips the right side of the
           * "Create trip" button. */}
          <div className="md:flex md:justify-end md:gap-2 md:pt-2 md:static md:bg-transparent md:px-0 md:py-0 md:border-t-0 md:mx-0
            sticky bottom-0 -mx-4 px-4 py-3 bg-bg/95 backdrop-blur border-t border-border flex gap-2">
            <Button type="button" variant="secondary" size="lg" className="flex-1 md:flex-initial" asChild>
              <Link href="/trips">{tA('cancel')}</Link>
            </Button>
            <Button type="submit" variant="accent" size="lg" className="flex-1 md:flex-initial" disabled={pending}
              iconLeft={pending ? <Loader2 className="animate-spin" /> : <Save />}>
              {pending ? t('submitCreating') : t('submitCreate')}
            </Button>
          </div>
        </div>
        {/* end left column */}

        {/* Right column — desktop-only sticky map fills column height. */}
        <aside className="hidden lg:flex lg:flex-col lg:h-full">
          <MapPreview
            pickup={pickup}
            dropoff={dropoff}
            stopovers={stopovers}
            heightClassName="h-full min-h-[300px]"
            showFullscreenLink
            className="flex-1 flex flex-col [&>div:last-child]:flex-1"
          />
        </aside>
      </div>
      <GuardConfirmDialog state={guard.dialog} pending={pending} />
    </form>
  );
}

/* Passenger Select option row — avatar + name + email subtitle.
 * Radix copies SelectItem children into the trigger when a value is selected,
 * so the same row layout renders in both popover items AND the closed trigger.
 * `gap-2 min-w-0` + `truncate` keeps the trigger layout sane khi tên dài. */
function PassengerOptionRow({ name, email }: { name: string; email: string | null }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Avatar name={name} size="xs" />
      <div className="flex flex-col min-w-0 leading-tight text-left">
        <span className="text-sm font-medium text-text truncate">{name}</span>
        {email && email !== name && (
          <span className="text-[10.5px] text-text-faint truncate">{email}</span>
        )}
      </div>
    </div>
  );
}

/* Empty state khi tenant chưa có user nào dùng làm hành khách.
 * ADMIN: nút "Mời người dùng" → /users/new (in-app invite/sync).
 * MANAGER: chỉ hint vì /users/new bị middleware redirect cho non-admin. */
function PassengerEmptyState({
  canInvite,
  labels,
}: {
  canInvite: boolean;
  labels: { empty: string; hint: string; invite: string; contactAdmin: string };
}) {
  return (
    <div className="flex items-center gap-2 rounded border border-dashed border-border bg-surface-2 px-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text">{labels.empty}</div>
        <div className="text-xs text-text-muted truncate">
          {canInvite ? labels.hint : labels.contactAdmin}
        </div>
      </div>
      {canInvite && (
        <Button type="button" variant="accent" size="sm" iconLeft={<UserPlus />} asChild>
          <Link href="/users/new">{labels.invite}</Link>
        </Button>
      )}
    </div>
  );
}

/* Reusable driver/vehicle assignment select.
 * - Khi có options: Select bình thường + nút "+ Tạo mới" nhỏ bên phải (ADMIN).
 * - Khi options rỗng: panel empty state với CTA "+ Tạo mới" (ADMIN) hoặc hint
 *   liên hệ admin (MANAGER).
 *
 * Layout: select chiếm flex-1, action button chiếm shrink-0 với icon-only để
 * không vỡ grid 2 cột trên mobile (tổng width chỉ khoảng 36px button extra). */
function AssignmentSelect({
  value,
  onChange,
  options,
  placeholder,
  error,
  createHref,
  createLabel,
  emptyLabel,
  emptyHint,
  contactAdminLabel,
  canCreate,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder: string;
  error?: boolean;
  createHref: string;
  createLabel: string;
  emptyLabel: string;
  emptyHint: string;
  contactAdminLabel: string;
  canCreate: boolean;
}) {
  if (options.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded border border-dashed border-border bg-surface-2 px-3 py-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text">{emptyLabel}</div>
          <div className="text-xs text-text-muted truncate">
            {canCreate ? emptyHint : contactAdminLabel}
          </div>
        </div>
        {canCreate && (
          <Button type="button" variant="accent" size="sm" iconLeft={<Plus />} asChild>
            <Link href={createHref}>{createLabel}</Link>
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div className="flex-1 min-w-0">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger error={error} className="w-full min-w-0">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {canCreate && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={createLabel}
          title={createLabel}
          className="shrink-0"
          asChild
        >
          <Link href={createHref}><Plus /></Link>
        </Button>
      )}
    </div>
  );
}

/* Notes are optional — collapse to a button so they don't eat ~80px when
 * unused. If a draft restores non-empty notes, we expand automatically. */
function NotesDisclosure({
  notes,
  setNotes,
  labelOpen,
  labelField,
  placeholder,
}: {
  notes: string;
  setNotes: (v: string) => void;
  labelOpen: string;
  labelField: string;
  placeholder: string;
}) {
  const [expanded, setExpanded] = useState(!!notes);
  /* Sync open-state when draft restore hydrates notes after mount. */
  useEffect(() => {
    if (notes && !expanded) setExpanded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  if (!expanded) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        iconLeft={<Plus />}
        onClick={() => setExpanded(true)}
        className="h-7 px-2 mt-2 text-xs"
      >
        {labelOpen}
      </Button>
    );
  }
  return (
    <div className="mt-2.5">
      <Label className="mb-1 block text-xs">{labelField}</Label>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={placeholder}
        rows={2}
        maxLength={2000}
      />
    </div>
  );
}

