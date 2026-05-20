'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCheck, Loader2 } from 'lucide-react';
import { Button, toast } from '@car-v2/ui';
import { markAllReadAction } from '@/server/actions/notifications/notification.actions';

export function MarkAllReadButton() {
  const t = useTranslations('inbox');
  const [pending, start] = useTransition();

  const handle = () => {
    start(async () => {
      const result = await markAllReadAction();
      if (result.success) {
        toast.success(t('markAllReadSuccess', { n: result.data.count }));
      } else {
        toast.error(t('markReadFailed'));
      }
    });
  };

  return (
    <Button
      variant="ghost"
      size="md"
      iconLeft={pending ? <Loader2 className="animate-spin" /> : <CheckCheck />}
      onClick={handle}
      disabled={pending}
    >
      {t('markAllRead')}
    </Button>
  );
}
