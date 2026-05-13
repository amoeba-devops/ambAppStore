'use client';

import { useEffect, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn, Toaster } from '@car-v2/ui';
import { BottomTabNav } from './bottom-tab-nav';
import { SidebarNav } from './sidebar-nav';

const COLLAPSE_KEY = 'ccms.sidebar.collapsed';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
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
        <SidebarNav collapsed={collapsed} />
      </div>
      {/* Main: reserve bottom space on mobile for the fixed bottom-tab bar. */}
      <main className="flex-1 min-w-0 flex flex-col pb-[64px] md:pb-0">
        {children}
      </main>
      <div className="hidden md:contents">
        <CollapseHandle collapsed={collapsed} onClick={toggle} />
      </div>
      <BottomTabNav />
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
        /* X position: half-overflow the sidebar right edge.
         * sidebar w-[240px] expanded → button center at x=240, left = 240-14 = 226px
         * sidebar w-[64px] collapsed → button center at x=64,  left = 64-14  = 50px */
        collapsed ? 'left-[50px]' : 'left-[226px]',
      )}
    >
      {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
    </button>
  );
}
