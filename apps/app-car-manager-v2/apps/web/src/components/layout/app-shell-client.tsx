'use client';

import { useEffect, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn, Toaster } from '@car-v2/ui';
import type { LocalRole } from '@car-v2/shared/auth';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { BottomTabNav } from './bottom-tab-nav';
import { SidebarNav } from './sidebar-nav';

const COLLAPSE_KEY = 'ccms.sidebar.collapsed';

interface AppShellClientProps {
  role: LocalRole;
  /** Display name from AMA JWT (null if not provided). */
  userName: string | null;
  /** Email from AMA JWT (null if not provided). */
  userEmail: string | null;
  /** Server-counted pending trips in the user's visibility scope. */
  pendingTripCount: number;
  children: React.ReactNode;
}

/* Single application shell for every role.
 *
 * Driver vs Admin/Manager differ only in:
 *   1. Which nav items appear in the sidebar / bottom tab (see `nav-items.ts`
 *      — filtered by `roles` array per item).
 *   2. Which routes the middleware lets them visit (`isDriverAllowed` in
 *      `middleware.ts`).
 *
 * The chrome itself — sidebar on md+, BottomTabNav on mobile, PageHeader per
 * page, install prompt, toaster — is identical across roles. That was an
 * earlier (rolled-back) experiment to give drivers a distinct shell; user
 * feedback was that a visual split breaks design-system consistency and makes
 * the desktop driver view feel like a different app. So role-based variation
 * lives at the *content* layer now, not the *chrome* layer.
 *
 * `pendingTripCount` is server-fed from the wrapper RSC; sidebar renders it as
 * a numeric badge on the Trips nav item. 0 → no badge. */
export function AppShellClient({ role, userName, userEmail, pendingTripCount, children }: AppShellClientProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSE_KEY);
      if (stored !== null) setCollapsed(stored === '1');
    } catch {
      /* localStorage unavailable (incognito edge case) — fall through. */
    }
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <div className="flex min-h-dvh bg-bg text-text">
      {/* Sidebar — hidden on mobile, replaced by BottomTabNav below. */}
      <div className="hidden md:contents">
        <SidebarNav
          collapsed={collapsed}
          role={role}
          userName={userName}
          userEmail={userEmail}
          pendingTripCount={pendingTripCount}
        />
      </div>
      {/* Main: reserve bottom space on mobile for the fixed bottom-tab bar. */}
      <main className="flex-1 min-w-0 flex flex-col pb-[64px] md:pb-0">
        {children}
      </main>
      <div className="hidden md:contents">
        <CollapseHandle collapsed={collapsed} onClick={toggle} />
      </div>
      <BottomTabNav role={role} />
      <InstallPrompt />
      <Toaster />
    </div>
  );
}

interface CollapseHandleProps {
  collapsed: boolean;
  onClick: () => void;
}

/* Rendered at AppShell level with `position: fixed` so it can't be clipped by
 * any sticky/overflow ancestor and always overlays page chrome. */
function CollapseHandle({ collapsed, onClick }: CollapseHandleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      aria-expanded={!collapsed}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      className={cn(
        /* y=44 places the 28px button center on y=58 — aligned with PageHeader
         * title baseline ("Tổng quan") and the sidebar brand-header divider. */
        'fixed top-[44px] z-50',
        'h-7 w-7 rounded-full bg-surface border border-border shadow-sm',
        'flex items-center justify-center text-text-muted',
        'hover:bg-surface-2 hover:text-text hover:border-border-strong',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        'transition-[left] duration-180 motion-reduce:transition-none',
        /* X position: half-overflow the sidebar right edge. */
        collapsed ? 'left-[50px]' : 'left-[226px]',
      )}
    >
      {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
    </button>
  );
}
