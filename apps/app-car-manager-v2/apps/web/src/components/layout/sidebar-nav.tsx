'use client';

import { useTransition } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Car,
  ClipboardList,
  IdCard,
  Loader2,
  LogOut,
  PencilLine,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Avatar, cn, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@car-v2/ui';
import type { LocalRole } from '@car-v2/shared/auth';
import { useAllDrafts, type DraftEntry } from '@/hooks/use-all-drafts';
import { logoutAction } from '@/server/actions/auth/auth.actions';
import { activeKeyFor, navItemsForRole, type NavKey } from './nav-items';

/* Entity → child icon. Helps user recognise "this is a vehicle/trip/driver
 * draft" without reading text. */
const ENTITY_SUB_ICON: Record<DraftEntry['entity'], LucideIcon> = {
  trip: ClipboardList,
  vehicle: Car,
  driver: IdCard,
  unknown: PencilLine,
};

interface SidebarNavProps {
  collapsed: boolean;
  role: LocalRole;
  /** Server-fed: pending trips in visibility scope. 0 hides the badge. */
  pendingTripCount: number;
}

/** Map NavKey → metric counts. Keys absent or 0 → no badge. */
type MetricCounts = Partial<Record<NavKey, number>>;

/* Map sidebar nav keys to the draft `entity` values that should appear as
 * sub-items beneath them. Keys not in this map render with no submenu. */
const NAV_KEY_TO_ENTITY: Partial<Record<NavKey, DraftEntry['entity']>> = {
  trips: 'trip',
  vehicles: 'vehicle',
  drivers: 'driver',
};

export function SidebarNav({ collapsed, role, pendingTripCount }: SidebarNavProps) {
  const tNav   = useTranslations('nav');
  const tCo    = useTranslations('company');
  const tAct   = useTranslations('actions');
  const tGroup = useTranslations();
  const pathname = usePathname();
  const active = activeKeyFor(pathname ?? '/');
  const [signingOut, startSignOut] = useTransition();

  const { drafts, removeDraft } = useAllDrafts();
  /* Group drafts by nav key so each NavGroup can render relevant children
   * inline. Cheaper than scanning the array per nav item. */
  const draftsByNavKey = new Map<NavKey, DraftEntry[]>();
  for (const [navKey, entity] of Object.entries(NAV_KEY_TO_ENTITY) as [NavKey, DraftEntry['entity']][]) {
    const matching = drafts.filter((d) => d.entity === entity);
    if (matching.length > 0) draftsByNavKey.set(navKey, matching);
  }

  /* Server-fed metric counts per nav key. Currently just trips; vehicles/drivers
   * could opt in later (e.g. "vehicles in maintenance"). */
  const metricCounts: MetricCounts = {
    trips: pendingTripCount,
  };

  const handleSignOut = () => {
    startSignOut(async () => {
      await logoutAction();
      window.location.href = '/session-expired';
    });
  };

  const items = navItemsForRole(role);
  const workspace = items.filter((i) => i.group === 'workspace');
  const admin = items.filter((i) => i.group === 'admin');

  return (
    <aside
      className={cn(
        'shrink-0 h-screen sticky top-0 border-r border-border bg-surface flex flex-col',
        'transition-[width] duration-180 motion-reduce:transition-none',
        collapsed ? 'w-[64px]' : 'w-[240px]',
      )}
      aria-label={tGroup('layout.sidebarAria')}
    >
      {/* Brand */}
      <div className="h-14 px-3 flex items-center gap-2.5 border-b border-border">
        <div className="h-8 w-8 rounded-md bg-primary text-primary-fg flex items-center justify-center font-bold text-sm shrink-0">
          {tCo('tenantInitial')}
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="text-sm font-semibold text-text leading-tight truncate">{tGroup('appName')}</div>
            <div className="text-xs text-text-muted truncate">{tCo('tenant')}</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-5">
        <NavGroup
          label={tGroup('workspace')}
          items={workspace}
          activeKey={active}
          collapsed={collapsed}
          draftsByNavKey={draftsByNavKey}
          metricCounts={metricCounts}
          onRemoveDraft={removeDraft}
          t={(key: NavKey) => tNav(key === 'audit' ? 'auditLog' : key)}
        />
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

      {/* Footer: user card + sign-out */}
      <div className="border-t border-border p-2">
        {collapsed ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              aria-label={tAct('signOut')}
              title={`${tCo('currentUser')} — ${tAct('signOut')}`}
              className="h-9 w-9 rounded flex items-center justify-center hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              {signingOut ? <Loader2 className="h-4 w-4 animate-spin text-text-muted" /> : <Avatar name={tCo('currentUser')} size="sm" />}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-surface-2 transition-colors">
            <Avatar name={tCo('currentUser')} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-text truncate">{tCo('currentUser')}</div>
              <div className="text-xs text-text-muted truncate">{tCo('currentUserRole')}</div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              aria-label={tAct('signOut')}
              title={tAct('signOut')}
              className="h-7 w-7 rounded flex items-center justify-center text-text-faint hover:bg-surface hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              {signingOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

interface NavGroupProps {
  label: string;
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
  const tDrafts = useTranslations('layout.drafts');
  const tNav = useTranslations('nav');

  return (
    <div>
      {!collapsed && (
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
                    ? 'bg-primary text-primary-fg'
                    : 'text-text-muted hover:bg-surface-2 hover:text-text',
                  collapsed && 'justify-center',
                )}
              >
                <item.Icon className="h-4 w-4 shrink-0" aria-hidden />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate text-left">{t(item.key)}</span>
                    {/* Only the operational metric (pending) shows a parent badge —
                     * draft work is already represented as sub-items below, so a
                     * count there would be redundant noise. */}
                    {metricCount > 0 ? (
                      <span
                        className={cn(
                          'text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full tabular shrink-0 inline-flex items-baseline gap-0.5',
                          isActive
                            ? 'bg-primary-fg/15 text-primary-fg'
                            : 'bg-info-soft text-info',
                        )}
                        title={tNav('pendingCountTitle', { n: metricCount })}
                      >
                        <span>{metricCount}</span>
                        <span className="text-[9px] font-medium uppercase tracking-wide opacity-90">
                          {tNav('pendingBadgeLabel')}
                        </span>
                      </span>
                    ) : item.staticBadge ? (
                      <span
                        className={cn(
                          'text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full tabular shrink-0',
                          isActive
                            ? 'bg-primary-fg/15 text-primary-fg'
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
