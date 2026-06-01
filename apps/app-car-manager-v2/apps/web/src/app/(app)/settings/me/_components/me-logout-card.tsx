'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { Button } from '@car-v2/ui';
import { logoutAction } from '@/server/actions/auth/auth.actions';
import { LogoutConfirmDialog } from '@/components/auth/logout-confirm-dialog';

/* Logout affordance. Opens a confirm dialog that wipes this browser's session
 * caches (keeping notifications) before the server action clears the cookies
 * and redirects to `/session-expired`. */
export function MeLogoutCard() {
  const tMe = useTranslations('settings.me');
  const tAct = useTranslations('actions');
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-md font-semibold text-text">{tMe('logoutTitle')}</div>
        <p className="text-sm text-text-muted mt-0.5">{tMe('logoutDesc')}</p>
      </div>
      <Button
        variant="danger"
        size="2xl"
        onClick={() => setOpen(true)}
        iconLeft={<LogOut />}
        className="w-full md:w-auto md:min-w-[200px]"
      >
        {tAct('signOut')}
      </Button>
      <LogoutConfirmDialog open={open} onOpenChange={setOpen} perform={() => logoutAction()} />
    </div>
  );
}
