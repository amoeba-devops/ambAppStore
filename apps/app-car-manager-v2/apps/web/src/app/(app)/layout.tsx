import { AppShell } from '@/components/layout/app-shell';

/**
 * Shared layout for all authenticated pages. The AppShell (sidebar + header
 * chrome) is rendered ONCE here — Next.js preserves it across navigations,
 * so switching sidebar items only re-renders the page segment and triggers
 * the segment-level loading.tsx (not the whole shell).
 *
 * The previous CRITICAL maintenance-alert sticky banner (oil/inspection
 * overdue, REQ-20260519 Q7) has been removed from this layout — the alert
 * UI is being redefined elsewhere. The OilOverdueBanner component and the
 * getCriticalUnresolvedAlerts query are still in the codebase for that
 * future placement to consume.
 */
export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
