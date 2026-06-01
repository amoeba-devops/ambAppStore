'use client';

import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { Button } from '@car-v2/ui';
import { LogoutConfirmDialog } from '@/components/auth/logout-confirm-dialog';

/* Driver "switch driver" = a logout. Opens the same confirm dialog (wipes this
 * browser's session caches, keeps notifications) before navigating to the
 * /api/auth/logout route. */
export function SwitchDriverButton({ label }: { label: string }) {
  const [open, setOpen] = useState(false);

  const perform = () => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    window.location.href = `${basePath}/api/auth/logout`;
  };

  return (
    <>
      <Button variant="ghost" size="md" iconLeft={<LogOut />} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <LogoutConfirmDialog open={open} onOpenChange={setOpen} perform={perform} />
    </>
  );
}
