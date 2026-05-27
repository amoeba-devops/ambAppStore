'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Bell } from 'lucide-react';
import { cn } from '@car-v2/ui';
import { useUserDisplay } from './user-display-context';

/* Always-visible inbox affordance — sits in the top header next to the user
 * avatar. The badge shows the server-counted unread notification total
 * (capped at "9+" for layout). 0 hides the badge. Click navigates to /inbox.
 *
 * Two variants:
 *   - default ("desktop"): rounded ghost button with bell icon, ~36px square,
 *     fits in PageHeader's actions area.
 *   - "mobile": slightly smaller (h-9 w-9), matches MeAvatarLink dimensions
 *     so the mobile header row stays aligned.
 *
 * Badge:
 *   - position absolute top-right of the bell, ring-2 against the page bg so
 *     it reads as a callout rather than a hat on the icon
 *   - red (danger) — universal "unread" colour, matches BottomTabNav's
 *     pending-count badge style. */
interface NotificationBellProps {
  variant?: 'desktop' | 'mobile';
  className?: string;
}

export function NotificationBell({ variant = 'desktop', className }: NotificationBellProps) {
  const { unreadNotifications } = useUserDisplay();
  const tNav = useTranslations('nav');

  const sizeClass = variant === 'mobile' ? 'h-9 w-9' : 'h-9 w-9 md:h-10 md:w-10';
  const iconSize = variant === 'mobile' ? 'h-5 w-5' : 'h-4 w-4 md:h-[18px] md:w-[18px]';

  const ariaLabel =
    unreadNotifications > 0
      ? `${tNav('inbox')} (${unreadNotifications} ${unreadNotifications === 1 ? 'unread' : 'unread'})`
      : tNav('inbox');

  /* Cap badge display at "9+" so it never grows past two characters and
   * pushes the surrounding header layout. Real count still reflected by
   * aria-label for screen-reader users. */
  const badgeText = unreadNotifications > 9 ? '9+' : String(unreadNotifications);

  return (
    <Link
      href="/inbox"
      aria-label={ariaLabel}
      title={ariaLabel}
      className={cn(
        'relative shrink-0 inline-flex items-center justify-center rounded-full',
        sizeClass,
        'text-text-muted hover:bg-surface-2 hover:text-text active:bg-surface-2/80',
        'transition-[background-color,color] duration-150 motion-reduce:transition-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        className,
      )}
    >
      <Bell className={iconSize} aria-hidden />
      {unreadNotifications > 0 && (
        <span
          className={cn(
            'absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1',
            'inline-flex items-center justify-center rounded-full',
            'bg-danger text-white text-[10px] font-bold leading-none tabular-nums',
            'ring-2 ring-surface',
          )}
        >
          {badgeText}
        </span>
      )}
    </Link>
  );
}
