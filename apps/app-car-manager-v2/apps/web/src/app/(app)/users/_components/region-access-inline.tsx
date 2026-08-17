'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Badge, Button, cn, toast } from '@car-v2/ui';
import { TRUCK_REGIONS, type TruckRegion } from '@car-v2/shared/zod';
import { setRegionAccessAction } from '@/server/actions/region-access/region-access.actions';
import { formatActionError } from '@/lib/format-action-error';

/** Same pill shape/size as `Badge size="sm"` (h-5) — one notch taller (h-6) so
 *  it still reads as clickable next to the plain dept badges above it, without
 *  towering over them the way a full `Button size="sm"` (h-8, square corners,
 *  visible border) did. */
const PILL =
  'h-6 rounded-full px-2.5 text-xs font-medium ring-1 ring-inset transition-colors ' +
  'focus-visible:ring-offset-1';
const PILL_OFF = 'bg-surface-2 text-text-muted ring-border hover:bg-surface-2/70';
const PILL_ON = 'bg-accent-soft text-accent ring-accent/20 hover:bg-accent-soft/70';

interface Props {
  userId: string;
  memberName: string;
  /** Currently granted regions. Empty = unrestricted (sees every region). */
  regions: TruckRegion[];
  /** `setRegionAccessAction` requires ADMIN server-side, but /users itself is
   *  reachable by MANAGER too (only DRIVER is redirected away) — a MANAGER
   *  viewer gets plain, non-interactive pills instead of controls that would
   *  fail with a permission error on click. */
  readOnly?: boolean;
}

/**
 * Quick-edit region toggles for a TRUCK, non-ADMIN member — mounted directly
 * on the /users list row (REQ-20260813 relocation) so an admin can narrow
 * several members' regions without leaving the roster. Styled as pills to
 * match the dept `Badge`s already in this column. Must be wrapped in
 * `StopRowClick` by the caller so it doesn't also trigger the row's peek
 * navigation.
 */
export function RegionAccessInline({ userId, memberName, regions, readOnly = false }: Props) {
  const t = useTranslations('users.list');
  const tRegion = useTranslations('region');
  const tErr = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<TruckRegion[]>(regions);

  if (readOnly) {
    return (
      <div className="flex flex-wrap items-center gap-1">
        {regions.length === 0 ? (
          <Badge tone="neutral" size="sm">{t('regionAllDefault')}</Badge>
        ) : (
          regions.map((r) => <Badge key={r} tone="accent" size="sm">{tRegion(r)}</Badge>)
        )}
      </div>
    );
  }

  const dirty = draft.length !== regions.length || draft.some((r) => !regions.includes(r));

  const toggle = (region: TruckRegion) =>
    setDraft((s) => (s.includes(region) ? s.filter((r) => r !== region) : [...s, region]));

  const save = () => {
    startTransition(async () => {
      const ordered = TRUCK_REGIONS.filter((r) => draft.includes(r));
      const res = await setRegionAccessAction({ userId, regions: ordered });
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      toast.success(
        ordered.length === 0
          ? t('regionClearedToast', { name: memberName })
          : t('regionSavedToast', { name: memberName, count: ordered.length }),
      );
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {draft.length === 0 && (
        <Badge tone="neutral" size="sm">{t('regionAllDefault')}</Badge>
      )}
      {TRUCK_REGIONS.map((region) => {
        const on = draft.includes(region);
        return (
          <Button
            key={region}
            type="button"
            variant="ghost"
            disabled={pending}
            aria-pressed={on}
            onClick={() => toggle(region)}
            className={cn(PILL, on ? PILL_ON : PILL_OFF)}
          >
            {tRegion(region)}
          </Button>
        );
      })}
      {dirty && (
        <Button
          type="button"
          variant="accent"
          disabled={pending}
          onClick={save}
          iconLeft={pending ? <Loader2 className="h-3 w-3 animate-spin" /> : undefined}
          className={cn(PILL, 'ring-accent/20')}
        >
          {t('regionSave')}
        </Button>
      )}
    </div>
  );
}
