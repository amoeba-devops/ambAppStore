import { getCurrentUser } from '@/lib/auth/get-current-user';
import { AppShellClient } from './app-shell-client';

/**
 * Server wrapper around AppShellClient. Reads the auth context once and passes
 * the role down so the client sidebar can filter NAV_ITEMS without exposing
 * server helpers to client code. Pages keep importing `AppShell` (this file).
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return <AppShellClient role={user.role}>{children}</AppShellClient>;
}
