'use client';

import { useEffect, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn, Toaster } from '@car-v2/ui';
import type { LocalRole } from '@car-v2/shared/auth';
import { NotificationSound } from '@/components/notification-sound';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { PushConfigProvider } from '@/components/pwa/push-config-context';
import { PushPromptStrip } from '@/components/pwa/push-prompt-strip';
import { OilOverdueBanner, type CriticalAlertItem } from '@/components/maintenance/oil-overdue-banner';
import { BottomTabNav } from './bottom-tab-nav';
import { DeptProvider } from './dept-context';
import type { FleetDept } from './nav-items';
import { SidebarNav } from './sidebar-nav';
import { TenantDisplayProvider } from './tenant-display-context';
import { UserDisplayProvider } from './user-display-context';

const COLLAPSE_KEY = 'ccms.sidebar.collapsed';

interface AppShellClientProps {
  role: LocalRole;
  /** Fleet departments the user may enter (drives the dept switch + nav). */
  fleetAccess: FleetDept[];
  /** Server-resolved sticky workspace seed (cookie clamped to access). */
  initialDept: FleetDept;
  /** Display name from AMA JWT (null if not provided). */
  userName: string | null;
  /** Email from AMA JWT (null if not provided). */
  userEmail: string | null;
  /** Server-counted pending trips in the user's visibility scope. */
  pendingTripCount: number;
  /** Server-counted expenses submitted today (Asia/Ho_Chi_Minh). STAFF
   * sidebar + mobile bottom-tab render a small badge on the Chi phí entry
   * when this is > 0. 0 for DRIVER (badge is STAFF-only). */
  todayExpenseCount: number;
  /** Server-counted truck reports created since this user last opened the
   * reports list — "Mới" badge on the truck Reports nav. 0 hides it. */
  newReportCount: number;
  /** Server-counted unread inbox notifications for this user. Drives the
   * red badge on the header notification bell (desktop + mobile). */
  unreadNotificationCount: number;
  /** VAPID public key + Next basePath for the push enable banner.
   * Both come from NEXT_PUBLIC_* env via the server-side AppShell wrapper. */
  vapidPublicKey: string | undefined;
  basePath: string;
  /** Resolved tenant display name (DB → JWT → i18n default). Seeds the
   * TenantDisplayProvider so the sidebar header + admin settings UI share
   * a single source of truth that updates in real-time. */
  tenantName: string;
  /** i18n default used when the admin clears the customized tenant name. */
  tenantDefaultName: string;
  /** Resolved app display name (DB → i18n `appName` default). */
  appName: string;
  /** i18n default used when the admin clears the customized app name. */
  appDefaultName: string;
  /** Unresolved CRITICAL maintenance alerts (staff only; empty for drivers). */
  criticalAlerts: CriticalAlertItem[];
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
export function AppShellClient({
  role,
  fleetAccess,
  initialDept,
  userName,
  userEmail,
  pendingTripCount,
  todayExpenseCount,
  newReportCount,
  unreadNotificationCount,
  vapidPublicKey,
  basePath,
  tenantName,
  tenantDefaultName,
  appName,
  appDefaultName,
  criticalAlerts,
  children,
}: AppShellClientProps) {
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
    <TenantDisplayProvider
      initialName={tenantName}
      defaultName={tenantDefaultName}
      initialAppName={appName}
      defaultAppName={appDefaultName}
    >
      <UserDisplayProvider userName={userName} userEmail={userEmail} role={role} unreadNotifications={unreadNotificationCount}>
      <PushConfigProvider vapidPublicKey={vapidPublicKey} basePath={basePath}>
        <DeptProvider role={role} fleetAccess={fleetAccess} initialDept={initialDept}>
        <div className="flex min-h-dvh bg-bg text-text">
          {/* Sidebar — hidden on mobile, replaced by BottomTabNav below.
           * Push enablement is surfaced via PushPromptStrip below (a top-of-
           * content strip), so the sidebar itself stays focused on nav. */}
          <div className="hidden md:contents">
            <SidebarNav
              collapsed={collapsed}
              role={role}
              fleetAccess={fleetAccess}
              userName={userName}
              userEmail={userEmail}
              pendingTripCount={pendingTripCount}
              todayExpenseCount={todayExpenseCount}
              newReportCount={newReportCount}
            />
          </div>
          {/* Main: reserve bottom space on mobile for the fixed bottom-tab
           * bar. PushPromptStrip sits BEFORE children so it occupies the
           * band right above each page's PageHeader — spans from the right
           * edge of the sidebar to full screen width (full width on mobile
           * where the sidebar is hidden). Only renders when push is actually
           * actionable; otherwise no vertical space is consumed. */}
          {/* Bottom padding reserves the band the fixed BottomTabNav covers
           * so page content doesn't scroll underneath it. The nav is 56px
           * (h-14) PLUS the device safe-area-inset-bottom (~34px on a
           * notched iPhone, 0 elsewhere). Previously we hard-coded 64px,
           * which under-reserved on notched iPhones and let the last ~26px
           * of content scroll behind the nav's safe-area cushion. Computing
           * the inset live keeps the reserved band exact on every device. */}
          <main className="flex-1 min-w-0 flex flex-col md:pb-0 pb-[calc(56px+env(safe-area-inset-bottom,0px))]">
            <PushPromptStrip />
            {/* Module 2 (REQ-20260519 Q7): CRITICAL maintenance alerts ride a
             * sticky band above every page for staff. Renders nothing when the
             * list is empty or the user dismissed it this session. */}
            <OilOverdueBanner items={criticalAlerts} />
            {children}
          </main>
          <div className="hidden md:contents">
            <CollapseHandle collapsed={collapsed} onClick={toggle} />
          </div>
          <BottomTabNav
            role={role}
            pendingTripCount={pendingTripCount}
            todayExpenseCount={todayExpenseCount}
            newReportCount={newReportCount}
          />
          <InstallPrompt />
          <Toaster />
          <NotificationSound />
        </div>
        </DeptProvider>
      </PushConfigProvider>
      </UserDisplayProvider>
    </TenantDisplayProvider>
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
