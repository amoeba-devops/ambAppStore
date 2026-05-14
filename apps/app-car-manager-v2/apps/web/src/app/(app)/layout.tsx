import { AppShell } from '@/components/layout/app-shell';

/**
 * Shared layout for all authenticated pages. The AppShell (sidebar + header
 * chrome) is rendered ONCE here — Next.js preserves it across navigations,
 * so switching sidebar items only re-renders the page segment and triggers
 * the segment-level loading.tsx (not the whole shell).
 */
export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
