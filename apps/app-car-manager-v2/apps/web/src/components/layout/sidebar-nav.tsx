'use client';

import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  Car,
  ChevronsUpDown,
  ClipboardList,
  IdCard,
  LogOut,
  PencilLine,
  Receipt,
  User as UserIcon,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  Avatar,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@car-v2/ui';
import type { LocalRole } from '@car-v2/shared/auth';
import { useAllDrafts, type DraftEntry } from '@/hooks/use-all-drafts';
import { LogoutConfirmDialog } from '@/components/auth/logout-confirm-dialog';
import { useActiveDept } from './dept-context';
import { DeptSwitch } from './dept-switch';
import { activeKeyFor, navItemsForRole, type FleetDept, type NavKey } from './nav-items';
import { SidebarInboxLink } from './notification-bell';
import { SidebarLocaleSwitcher } from './sidebar-locale-switcher';
import { useTenantDisplay } from './tenant-display-context';
import { UserGuideDrawer } from './user-guide-drawer';

/* Entity → child icon. Helps user recognise "this is a vehicle/trip/driver/
 * expense draft" without reading text. */
const ENTITY_SUB_ICON: Record<DraftEntry['entity'], LucideIcon> = {
  trip: ClipboardList,
  vehicle: Car,
  driver: IdCard,
  expense: Receipt,
  unknown: PencilLine,
};

interface SidebarNavProps {
  collapsed: boolean;
  role: LocalRole;
  /** Fleet departments the user may enter — drives the dept switch + which
   * department's nav items show. */
  fleetAccess: FleetDept[];
  /** Real user display name from AMA JWT. Fallback to email/role if null. */
  userName: string | null;
  /** Email from AMA JWT. Used as secondary text and Avatar fallback. */
  userEmail: string | null;
  /** Server-fed: pending trips in visibility scope. 0 hides the badge. */
  pendingTripCount: number;
  /** Server-fed: expenses submitted today (Asia/Ho_Chi_Minh). 0 hides the
   * "N hôm nay" badge on the Chi phí nav item. STAFF only — passed as 0
   * for DRIVER (the costs nav item isn't in their role anyway). */
  todayExpenseCount: number;
  /** Server-fed: truck reports created since the user last opened the list.
   * Drives the "Mới" badge on the truck Reports nav item. 0 hides it. */
  newReportCount: number;
}

/** Map NavKey → metric counts. Keys absent or 0 → no badge. */
type MetricCounts = Partial<Record<NavKey, number>>;

/* Map sidebar nav keys to the draft `entity` values that should appear as
 * sub-items beneath them. Keys not in this map render with no submenu. */
const NAV_KEY_TO_ENTITY: Partial<Record<NavKey, DraftEntry['entity']>> = {
  trips: 'trip',
  vehicles: 'vehicle',
  drivers: 'driver',
  costs: 'expense',
};

export function SidebarNav({ collapsed, role, fleetAccess, userName, userEmail, pendingTripCount, todayExpenseCount, newReportCount }: SidebarNavProps) {
  const tNav   = useTranslations('nav');
  const tCo    = useTranslations('company');
  const tAct   = useTranslations('actions');
  const tRole  = useTranslations('settings.me.roles');
  const tDept  = useTranslations('layout.dept');
  const tGroup = useTranslations();
  const pathname = usePathname();
  // locale + guide href no longer needed here — UserGuideDrawer reads locale +
  // pathname itself and deep-links to the matching role × page.
  /* Live tenant display — re-renders whenever an Admin edits the name in
   * Settings, no route reload required. Seed value comes from AppShell. */
  const tenant = useTenantDisplay();

  /* Display name fallback chain:
   *   userName → email local part → "User"
   * Role uses i18n (Quản trị / Quản lý / Tài xế). */
  const displayName = userName?.trim() || userEmail?.split('@')[0] || 'User';
  /* Hướng B / B1: a manager scoped to a single fleet IS that department's
   * admin (same workspace-only powers), so surface "Quản trị xe tải/xe con" as
   * their title. Org admins keep "Quản trị viên"; 2-dept managers stay "Quản
   * lý"; drivers unchanged. Label only — permissions are not affected. */
  const displayRole =
    role === 'MANAGER' && fleetAccess.length === 1
      ? tDept(fleetAccess[0] === 'TRUCK' ? 'deptAdminTruck' : 'deptAdminCar')
      : tRole(role);
  /* Email shown as secondary line if available + different from display name. */
  const showEmailLine = userEmail && userEmail !== displayName;
  /* Pass role so `/` correctly maps to `today` for drivers and `dashboard`/`trips`
   * for admin/manager — otherwise the driver's first tab would never light up
   * since dashboard/trips isn't in their filtered items. */
  const active = activeKeyFor(pathname ?? '/', role);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const { drafts, removeDraft } = useAllDrafts();
  /* Group drafts by nav key so each NavGroup can render relevant children
   * inline. Cheaper than scanning the array per nav item. */
  const draftsByNavKey = new Map<NavKey, DraftEntry[]>();
  for (const [navKey, entity] of Object.entries(NAV_KEY_TO_ENTITY) as [NavKey, DraftEntry['entity']][]) {
    const matching = drafts.filter((d) => d.entity === entity);
    if (matching.length > 0) draftsByNavKey.set(navKey, matching);
  }

  /* Server-fed metric counts per nav key. Trips = pending awaiting action;
   * Costs = today's submitted total. Vehicles / drivers could opt in later
   * (e.g. "vehicles in maintenance"). */
  const metricCounts: MetricCounts = {
    trips: pendingTripCount,
    costs: todayExpenseCount,
    truckReports: newReportCount,
  };

  /* Passed to the confirm dialog as `perform` — runs AFTER the client wipes
   * web storage + caches. Uses the /api/auth/logout route (clears all 3 cookies
   * + best-effort AMA logout). basePath prefix required — staging mounts the app
   * under /app-car-manager-v2, so a raw '/api/auth/logout' would hit the nginx
   * parent and return PLT-E9999. */
  const performSignOut = () => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    window.location.href = `${basePath}/api/auth/logout`;
  };

  /* Desktop sidebar drops the `me` nav entry — the avatar at the footer is
   * already the canonical "current user" affordance on desktop (clicks open a
   * dropdown with Me + Sign out), so a separate row was redundant. Mobile keeps
   * the avatar in MobilePageHeader, which already links to /settings/me. */
  /* Sticky active workspace (from DeptProvider). The nav shows that
   * department's items + department-agnostic shared ones, and — unlike the old
   * URL-derived value — stays put when the user opens a shared admin page
   * (drivers/users/settings/audit) instead of snapping back to car. */
  const dept = useActiveDept();
  const allItems = navItemsForRole(role, { dept });
  const workspace = allItems.filter((i) => i.group === 'workspace' && i.key !== 'me');
  const admin = allItems.filter((i) => i.group === 'admin');

  /* Workspace renders as a single group (car: items have no `section`) or as
   * the truck IA sub-sections. Fixed display order; empty sections self-hide
   * (NavGroup returns null for 0 items). Labels live at i18n root. */
  const SECTION_ORDER = ['workspace', 'operations', 'finance', 'data', 'reports'] as const;
  const sectionLabelKey: Record<string, string> = {
    workspace: 'workspace',
    operations: 'navSections.operations',
    finance: 'navSections.finance',
    data: 'navSections.data',
    reports: 'navSections.reports',
  };

  return (
    <aside
      className={cn(
        'shrink-0 h-screen sticky top-0 border-r border-border bg-surface flex flex-col',
        'transition-[width] duration-180 motion-reduce:transition-none',
        collapsed ? 'w-[64px]' : 'w-[240px]',
      )}
      aria-label={tGroup('layout.sidebarAria')}
    >
      {/* Brand — both lines come from TenantDisplayProvider so Admin edits
       * in Settings flow here without a route reload. App name (top line)
       * falls back to the i18n `appName` default; tenant name (bottom line)
       * falls back through JWT → i18n. Push enablement is handled by
       * PushPromptStrip above page content, not in this brand header. */}
      <div className="h-14 px-3 flex items-center gap-2.5 border-b border-border">
        <div
          className="h-8 w-8 rounded-md bg-primary text-primary-fg flex items-center justify-center font-bold text-sm shrink-0"
          title={tenant.name}
        >
          {tenant.initials}
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="text-sm font-semibold text-text leading-tight truncate" title={tenant.appName}>
              {tenant.appName}
            </div>
            <div className="text-xs text-text-muted truncate" title={tenant.name}>{tenant.name}</div>
          </div>
        )}
      </div>

      {/* Fleet department switch — renders only for users with both
       * departments (toggle) or a manager who can request truck access. */}
      <div className="px-2 pt-2 empty:hidden">
        <DeptSwitch role={role} fleetAccess={fleetAccess} collapsed={collapsed} />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-5">
        {SECTION_ORDER.map((sec) => (
          <NavGroup
            key={sec}
            label={tGroup(sectionLabelKey[sec])}
            items={workspace.filter((i) => (i.section ?? 'workspace') === sec)}
            activeKey={active}
            collapsed={collapsed}
            draftsByNavKey={draftsByNavKey}
            metricCounts={metricCounts}
            onRemoveDraft={removeDraft}
            t={(key: NavKey) => tNav(key === 'audit' ? 'auditLog' : key)}
          />
        ))}
        <NavGroup
          label={tGroup('admin')}
          items={admin}
          activeKey={active}
          collapsed={collapsed}
          draftsByNavKey={draftsByNavKey}
          metricCounts={metricCounts}
          onRemoveDraft={removeDraft}
          t={(key: NavKey) => tNav(key === 'audit' ? 'auditLog' : key)}
        />
      </nav>

      {/* Hộp thư (QA P2 R3) — the notification bell lives HERE, app-level,
       * instead of next to each page's title where it read as a page feature. */}
      <div className="border-t border-border p-2">
        <SidebarInboxLink collapsed={collapsed} />
      </div>

      {/* Quick locale switcher — admin/manager often flip between vi/en/ko
       * for cross-team demos. Putting it permanently in the rail avoids the
       * 3-click roundtrip to /settings/me. Driver path unchanged (no sidebar
       * on mobile). */}
      <div className="border-t border-border p-2">
        <SidebarLocaleSwitcher collapsed={collapsed} />
      </div>

      {/* Permanent User Guide entry — opens the in-app drawer deep-linked to
       * the page matching (pathname × role × locale). Drawer header carries
       * an "open in new tab" icon for users who want the full standalone
       * doc view. Mirrors the mobile header icon for cross-device parity. */}
      <div className="border-t border-border p-2">
        <TooltipProvider delayDuration={400} disableHoverableContent>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <UserGuideDrawer
                  role={role}
                  trigger={
                    <button
                      type="button"
                      aria-label={tNav('userGuideAria')}
                      className={cn(
                        'mx-auto flex items-center justify-center h-9 w-9 rounded',
                        'text-text-muted hover:bg-surface-2 hover:text-text',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      )}
                    >
                      <BookOpen className="h-4 w-4" aria-hidden />
                    </button>
                  }
                />
              </TooltipTrigger>
              <TooltipContent side="right">{tNav('userGuide')}</TooltipContent>
            </Tooltip>
          ) : (
            <UserGuideDrawer
              role={role}
              trigger={
                <button
                  type="button"
                  aria-label={tNav('userGuideAria')}
                  className={cn(
                    'group flex items-center gap-2.5 h-9 w-full rounded px-2 text-sm font-medium',
                    'text-text-muted hover:bg-surface-2 hover:text-text transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                >
                  <BookOpen className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="flex-1 truncate text-left">{tNav('userGuide')}</span>
                </button>
              }
            />
          )}
        </TooltipProvider>
      </div>

      {/* Footer: avatar = user menu trigger (Me + Sign out).
       *
       * Same DropdownMenu in both collapsed and expanded modes — only the
       * trigger surface changes (icon button vs. full card). Anchored to the
       * top-right of the trigger with `side="top"` so the menu pops upward
       * away from the page-content area. */}
      <div className="border-t border-border p-2">
        <DropdownMenu>
          {collapsed ? (
            <TooltipProvider delayDuration={400} disableHoverableContent>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={displayName}
                      className={cn(
                        'mx-auto block h-9 w-9 rounded-full',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                        'transition-transform duration-150 motion-reduce:transition-none hover:scale-105 active:scale-95',
                        'data-[state=open]:ring-2 data-[state=open]:ring-ring',
                      )}
                    >
                      <Avatar name={displayName} size="sm" />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="right">{displayName}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={displayName}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2 py-1.5 rounded text-left',
                  'transition-colors duration-150 motion-reduce:transition-none',
                  'hover:bg-surface-2 active:bg-surface-2/80',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'data-[state=open]:bg-surface-2',
                )}
              >
                <Avatar name={displayName} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text truncate">{displayName}</div>
                  <div className="text-xs text-text-muted truncate">{displayRole}</div>
                </div>
                <ChevronsUpDown className="h-3.5 w-3.5 text-text-faint shrink-0" aria-hidden />
              </button>
            </DropdownMenuTrigger>
          )}

          <DropdownMenuContent
            side={collapsed ? 'right' : 'top'}
            align={collapsed ? 'end' : 'start'}
            sideOffset={collapsed ? 12 : 8}
            className="min-w-[220px]"
          >
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-text truncate">{displayName}</span>
              {showEmailLine && (
                <span className="text-xs font-normal text-text-muted truncate">{userEmail}</span>
              )}
              <span className="text-[10.5px] font-medium text-accent uppercase tracking-wide mt-0.5">
                {displayRole}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                href="/settings/me"
                className="flex items-center gap-2 w-full cursor-pointer"
              >
                <UserIcon aria-hidden />
                <span>{tNav('me')}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              {/* Opens the deep-linked in-app guide drawer instead of a new
               * tab — drawer header still offers an explicit "open in new
               * tab" icon for users who want the standalone doc view. */}
              <UserGuideDrawer
                role={role}
                trigger={
                  <button
                    type="button"
                    aria-label={tNav('userGuideAria')}
                    className="flex items-center gap-2 w-full cursor-pointer text-left"
                  >
                    <BookOpen aria-hidden />
                    <span>{tNav('userGuide')}</span>
                  </button>
                }
              />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              tone="danger"
              onSelect={() => {
                /* Let the menu close, then open the confirm dialog on the next
                 * tick so Radix's focus return (menu → trigger) doesn't fight
                 * the dialog's focus trap. */
                setTimeout(() => setLogoutOpen(true), 0);
              }}
            >
              <LogOut aria-hidden />
              <span>{tAct('signOut')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <LogoutConfirmDialog open={logoutOpen} onOpenChange={setLogoutOpen} perform={performSignOut} />
      </div>
    </aside>
  );
}

interface NavGroupProps {
  /** `null` skips the section heading entirely (used by the `me` tail block
   * which sits below a border separator and needs no extra label). */
  label: string | null;
  items: NavItem[];
  activeKey: NavKey;
  collapsed: boolean;
  draftsByNavKey: Map<NavKey, DraftEntry[]>;
  metricCounts: MetricCounts;
  onRemoveDraft: (key: string) => void;
  t: (key: NavKey) => string;
}
type NavItem = ReturnType<typeof navItemsForRole>[number];

function NavGroup({
  label,
  items,
  activeKey,
  collapsed,
  draftsByNavKey,
  metricCounts,
  onRemoveDraft,
  t,
}: NavGroupProps) {
  const tNav = useTranslations('nav');

  if (items.length === 0) return null;

  return (
    <div>
      {!collapsed && label && (
        <div className="text-[10.5px] font-semibold text-text-faint uppercase tracking-wider px-2 mb-1.5">
          {label}
        </div>
      )}
      <TooltipProvider delayDuration={400} disableHoverableContent>
        <ul className="space-y-0.5">
          {items.map((item) => {
            const isActive = item.key === activeKey;
            const itemDrafts = draftsByNavKey.get(item.key);
            /* metricCount = operational queue (e.g. pending trips for /trips).
             * Drafts are NOT counted at parent level — they're already visible
             * as sub-items below, so a numeric badge would be redundant. */
            const metricCount = metricCounts[item.key] ?? 0;
            const linkInner = (
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group flex items-center gap-2.5 h-9 rounded px-2 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-accent text-accent-fg'
                    : 'text-text-muted hover:bg-surface-2 hover:text-text',
                  collapsed && 'justify-center',
                )}
              >
                <item.Icon className="h-4 w-4 shrink-0" aria-hidden />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate text-left">{t(item.key)}</span>
                    {/* Operational metric badge — `trips` shows pending count
                     * (chờ), `costs` shows today's submitted count (hôm nay).
                     * Label + tooltip pick per-key so each badge reads in
                     * context instead of using a single generic word. */}
                    {metricCount > 0 ? (
                      <span
                        className={cn(
                          'text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full tabular shrink-0 inline-flex items-baseline gap-0.5',
                          isActive
                            ? 'bg-accent-fg/15 text-accent-fg'
                            : 'bg-info-soft text-info',
                        )}
                        title={
                          item.key === 'costs'
                            ? tNav('todayCountTitle', { n: metricCount })
                            : item.key === 'truckReports'
                              ? tNav('newReportsCountTitle', { n: metricCount })
                              : tNav('pendingCountTitle', { n: metricCount })
                        }
                      >
                        <span>{metricCount}</span>
                        <span className="text-[9px] font-medium uppercase tracking-wide opacity-90">
                          {item.key === 'costs'
                            ? tNav('todayBadgeLabel')
                            : item.key === 'truckReports'
                              ? tNav('newBadgeLabel')
                              : tNav('pendingBadgeLabel')}
                        </span>
                      </span>
                    ) : item.staticBadge ? (
                      <span
                        className={cn(
                          'text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full tabular shrink-0',
                          isActive
                            ? 'bg-accent-fg/15 text-accent-fg'
                            : 'bg-surface-2 text-text-muted',
                        )}
                      >
                        {item.staticBadge}
                      </span>
                    ) : null}
                  </>
                )}
                {/* Collapsed mode → tiny info dot only when there's a pending
                 * metric. Drafts are no longer counted at the parent level. */}
                {collapsed && metricCount > 0 && (
                  <span className="absolute mt-[-14px] ml-3 h-1.5 w-1.5 rounded-full bg-info ring-1 ring-surface" />
                )}
              </Link>
            );
            return (
              <li key={item.key}>
                {collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{linkInner}</TooltipTrigger>
                    <TooltipContent side="right">{t(item.key)}</TooltipContent>
                  </Tooltip>
                ) : (
                  linkInner
                )}
                {/* Sub-items: drafts for this nav item. Indented to align under
                 * the parent's label text (parent has px-2 + icon-16 + gap-2.5
                 * = ~34px before its label, so children pl-9 puts text close). */}
                {!collapsed && itemDrafts && itemDrafts.length > 0 && (
                  <ul className="mt-0.5 space-y-0.5">
                    {itemDrafts.map((d) => (
                      <li key={d.key}>
                        <DraftSubItem draft={d} onRemove={() => onRemoveDraft(d.key)} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </TooltipProvider>
    </div>
  );
}

function DraftSubItem({
  draft,
  onRemove,
}: {
  draft: DraftEntry;
  onRemove: () => void;
}) {
  const tDrafts = useTranslations('layout.drafts');
  const f = useFormatter();
  const Icon = ENTITY_SUB_ICON[draft.entity];

  /* Compose display strings up front so JSX stays readable. Fallback chain:
   *   primary from form  ▶  i18n fallback ("Đang thêm xe", etc)
   *   secondary from form ▶  null (no second line) */
  const primary =
    draft.label?.primary ??
    tDrafts(`fallback.${draft.entity}.${draft.mode === 'edit' ? 'edit' : 'new'}`);
  const secondary = draft.label?.secondary ?? null;
  const href = draft.href ?? buildFallbackHref(draft);

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(tDrafts('discardConfirm', { label: primary }))) {
      onRemove();
    }
  };

  return (
    <Link
      href={href}
      title={secondary ? `${primary} — ${secondary}` : primary}
      className={cn(
        /* Two-line draft card, indented so the icon sits roughly under the
         * parent's icon and the text aligns with the parent's label. Warning
         * border-left is the at-a-glance "you have unfinished work here" cue. */
        'group relative flex items-start gap-2 rounded pl-8 pr-2 py-1.5 text-xs transition-colors',
        'border-l-2 border-warning/50 bg-warning-soft/20 hover:bg-warning-soft/40',
        'text-text-muted hover:text-text',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-warning mt-0.5" aria-hidden />
      <div className="flex-1 min-w-0 leading-tight">
        <div className="font-medium text-text truncate">{primary}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-text-faint">
          {secondary && <span className="truncate">{secondary}</span>}
          {secondary && <span>·</span>}
          <span className="whitespace-nowrap tabular">
            {f.relativeTime(new Date(draft.savedAt), { now: Date.now() })}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={handleRemoveClick}
        aria-label={tDrafts('discardAria')}
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 h-5 w-5 inline-flex items-center justify-center rounded text-text-faint hover:bg-surface hover:text-danger focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shrink-0 self-start mt-0.5"
      >
        <X className="h-3 w-3" />
      </button>
    </Link>
  );
}

/** Best-effort URL when the form didn't pass `href` explicitly. */
function buildFallbackHref(draft: DraftEntry): string {
  /* Expense drafts only have a "new" form (no edit page yet) and the form
   * lives under `/expenses/new` regardless of who's recording it. The
   * landing page redirects non-driver to /costs first, so this URL works
   * for both Driver (lands directly) and Admin/Manager (single redirect). */
  if (draft.entity === 'expense') return '/expenses/new';
  const segment =
    draft.entity === 'trip' ? 'trips' :
    draft.entity === 'vehicle' ? 'vehicles' :
    draft.entity === 'driver' ? 'drivers' :
    null;
  if (!segment) return '/';
  if (draft.mode === 'new') return `/${segment}/new`;
  if (draft.mode === 'edit' && draft.entityId) return `/${segment}/${draft.entityId}/edit`;
  return `/${segment}`;
}
