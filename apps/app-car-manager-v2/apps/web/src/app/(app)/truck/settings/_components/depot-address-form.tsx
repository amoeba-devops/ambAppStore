'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, Loader2 } from 'lucide-react';
import { Button, toast } from '@car-v2/ui';
import { updateDepotAddressAction } from '@/server/actions/settings/tenant-settings.actions';
import { formatActionError } from '@/lib/format-action-error';

interface Props {
  initial: string | null;
}

export function DepotAddressForm({ initial }: Props) {
  const t = useTranslations('screens.truckSettings');
  const tErr = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(initial ?? '');

  const save = () => {
    startTransition(async () => {
      const res = await updateDepotAddressAction({ depot_address: value.trim() || null });
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      toast.success(t('depotAddressSaved'));
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">{t('depotAddressHint')}</p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t('depotAddressPlaceholder')}
        rows={2}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-ring resize-none"
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="accent"
          size="sm"
          disabled={pending}
          onClick={save}
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {t('save')}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => setValue('')}
          >
            {t('depotAddressClear')}
          </Button>
        )}
      </div>
    </div>
  );
}
