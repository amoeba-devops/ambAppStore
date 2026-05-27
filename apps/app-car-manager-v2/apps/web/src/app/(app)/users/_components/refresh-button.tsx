'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button, toast } from '@car-v2/ui';
import { refreshUsersAction } from '@/server/actions/users/refresh-users.action';

export function RefreshUsersButton() {
  const router = useRouter();
  const t = useTranslations('users.refresh');
  const [pending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(async () => {
      const res = await refreshUsersAction();
      if (!res.success) {
        toast.error(res.error.message);
        return;
      }
      router.refresh();
      toast.success(t('successToast', { count: res.data.count }), {
        description:
          res.data.skipped > 0
            ? t('skippedDesc', { count: res.data.skipped })
            : undefined,
      });
    });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="md"
      onClick={handleRefresh}
      disabled={pending}
      iconLeft={pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
    >
      <span className="hidden sm:inline">{t('label')}</span>
    </Button>
  );
}
