'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, Loader2 } from 'lucide-react';
import { Badge, Button, toast } from '@car-v2/ui';
import { TRUCK_REGIONS } from '@car-v2/shared/zod';
import { setRegionAccessAction } from '@/server/actions/region-access/region-access.actions';
import { formatActionError } from '@/lib/format-action-error';

interface Props {
  userId: string;
  memberName: string;
  /** Currently granted regions. Empty = unrestricted (sees every region). */
  regions: string[];
  /** ADMIN — always every region, nothing to narrow. */
  implicit: boolean;
  regionLabels: Record<string, string>;
}

export function RegionMemberControls({ userId, memberName, regions, implicit, regionLabels }: Props) {
  const t = useTranslations('screens.regionAccess');
  const tErr = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<string[]>(regions);

  if (implicit) {
    return (
      <Badge tone="accent" size="sm">
        {t('fullAccess')}
      </Badge>
    );
  }

  const dirty =
    draft.length !== regions.length || draft.some((r) => !regions.includes(r));

  const toggle = (region: string) =>
    setDraft((s) => (s.includes(region) ? s.filter((r) => r !== region) : [...s, region]));

  const save = () => {
    startTransition(async () => {
      /* Canonical order so the stored set matches the region list everywhere. */
      const ordered = TRUCK_REGIONS.filter((r) => draft.includes(r));
      const res = await setRegionAccessAction({ userId, regions: ordered });
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      toast.success(
        ordered.length === 0
          ? t('clearedToast', { name: memberName })
          : t('savedToast', { name: memberName, count: ordered.length }),
      );
      router.refresh();
    });
  };

  return (
    <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
      {draft.length === 0 && (
        <Badge tone="neutral" size="sm">
          {t('allRegionsDefault')}
        </Badge>
      )}
      {TRUCK_REGIONS.map((region) => {
        const on = draft.includes(region);
        return (
          <Button
            key={region}
            type="button"
            size="sm"
            variant={on ? 'accent' : 'ghost'}
            disabled={pending}
            aria-pressed={on}
            onClick={() => toggle(region)}
            iconLeft={on ? <Check className="h-3.5 w-3.5" /> : undefined}
          >
            {regionLabels[region] ?? region}
          </Button>
        );
      })}
      {dirty && (
        <Button
          type="button"
          size="sm"
          variant="accent"
          disabled={pending}
          onClick={save}
          iconLeft={pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : undefined}
        >
          {t('save')}
        </Button>
      )}
    </div>
  );
}
