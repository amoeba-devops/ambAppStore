'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCheck } from 'lucide-react';
import { Button, toast } from '@car-v2/ui';
import { markAllReadAction } from '@/server/actions/notifications/notification.actions';

interface MarkAllReadButtonProps {
  /* Mobile variant — icon-only square button so it fits the PageHeader's
   * single `mobileAction` slot (a ~40px area next to the title). Desktop
   * gets the labeled button by default. */
  mobile?: boolean;
}

export function MarkAllReadButton({ mobile = false }: MarkAllReadButtonProps) {
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

  if (mobile) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handle}
        disabled={pending}
        loading={pending}
        aria-label={t('markAllRead')}
        title={t('markAllRead')}
      >
        <CheckCheck />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="md"
      iconLeft={<CheckCheck />}
      onClick={handle}
      disabled={pending}
      loading={pending}
    >
      {t('markAllRead')}
    </Button>
  );
}
