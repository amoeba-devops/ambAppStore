'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Loader2, LogOut } from 'lucide-react';
import { Avatar, cn, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@car-v2/ui';
import type { LocalRole } from '@car-v2/shared/auth';
import { logoutAction } from '@/server/actions/auth/auth.actions';
import { activeKeyFor, navItemsForRole, type NavKey } from './nav-items';

interface SidebarNavProps {
  collapsed: boolean;
  role: LocalRole;
}

export function SidebarNav({ collapsed, role }: SidebarNavProps) {
  const tNav   = useTranslations('nav');
  const tCo    = useTranslations('company');
  const tAct   = useTranslations('actions');
  const tGroup = useTranslations();
  const pathname = usePathname();
  const active = activeKeyFor(pathname ?? '/');
  const [signingOut, startSignOut] = useTransition();

  const handleSignOut = () => {
    startSignOut(async () => {
      await logoutAction();
      /* Hard reload so middleware reads the now-cleared cookie and the
       * /session-expired page renders with a fresh server context. */
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
          t={(key: NavKey) => tNav(key === 'audit' ? 'auditLog' : key)}
        />
        <NavGroup
          label={tGroup('admin')}
          items={admin}
          activeKey={active}
          collapsed={collapsed}
          t={(key: NavKey) => tNav(key === 'audit' ? 'auditLog' : key)}
        />
      </nav>

      {/* Footer: user card + sign-out only. Collapse handle now lives on the
       * right edge of the sidebar. */}
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
  t: (key: NavKey) => string;
}
type NavItem = ReturnType<typeof navItemsForRole>[number];

function NavGroup({ label, items, activeKey, collapsed, t }: NavGroupProps) {
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
                    {item.staticBadge && (
                      <span
                        className={cn(
                          'text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full tabular',
                          isActive ? 'bg-primary-fg/15 text-primary-fg' : 'bg-surface-2 text-text-muted',
                        )}
                      >
                        {item.staticBadge}
                      </span>
                    )}
                  </>
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
                ) : linkInner}
              </li>
            );
          })}
        </ul>
      </TooltipProvider>
    </div>
  );
}
