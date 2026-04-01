import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications, useUnreadCount } from '@/hooks/useNotifications';
import { NotificationDropdown } from './NotificationDropdown';
import { useAuthStore } from '@/stores/auth.store';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data: unread } = useUnreadCount(isAuthenticated);
  const { data: notifications } = useNotifications(1, 10, open && isAuthenticated);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
      >
        <Bell className="h-5 w-5" />
        {(unread?.count ?? 0) > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread!.count > 99 ? '99+' : unread!.count}
          </span>
        )}
      </button>

      {open && (
        <NotificationDropdown
          notifications={notifications?.items ?? []}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
