import { getCurrentUser } from '@/lib/auth/get-current-user';
import { countPendingTrips } from '@/server/queries/trips.queries';
import { AppShellClient } from './app-shell-client';

/**
 * Server wrapper around AppShellClient. Reads the auth context once and passes
 * the role + sidebar metric counts down so the client sidebar can render
 * badges without exposing server helpers to client code.
 *
 * `pendingTripCount` runs on every page render (Neon HTTP is cheap, one SELECT
 * count) so the sidebar badge stays accurate as users navigate. No real-time
 * updates yet — refresh occurs on next route change. Caller can rely on Next.js
 * `revalidatePath('/')` from mutating actions to force a refresh when needed.
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const pendingTripCount = await countPendingTrips({
    entId: user.entId,
    role: user.role,
    userId: user.userId,
  });
  return (
    <AppShellClient role={user.role} pendingTripCount={pendingTripCount}>
      {children}
    </AppShellClient>
  );
}
