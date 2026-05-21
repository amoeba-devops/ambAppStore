import { getCurrentUser } from '@/lib/auth/get-current-user';
import { countPendingTrips } from '@/server/queries/trips.queries';
import { AppShellClient } from './app-shell-client';

/**
 * Server wrapper around AppShellClient. Reads the auth context once and passes
 * the role + sidebar metric counts + PWA push config down so the client shell
 * can render role-aware nav, badges, and the proactive push-enable banner
 * without exposing server helpers (or process.env) to client code.
 *
 * `pendingTripCount` runs on every page render (Neon HTTP is cheap, one SELECT
 * count) so the sidebar badge stays accurate as users navigate. No real-time
 * updates yet — refresh occurs on next route change. Caller can rely on Next.js
 * `revalidatePath('/')` from mutating actions to force a refresh when needed.
 *
 * `vapidPublicKey` + `basePath` flow through to PushPromptBanner so it can
 * decide whether to render (hidden when server can't push) and which SW URL
 * to register on enable. Both come from NEXT_PUBLIC_* envs but reading them
 * server-side here means the client never has to.
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const pendingTripCount = await countPendingTrips({
    entId: user.entId,
    role: user.role,
    userId: user.userId,
  });
  return (
    <AppShellClient
      role={user.role}
      pendingTripCount={pendingTripCount}
      vapidPublicKey={process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC}
      basePath={process.env.NEXT_PUBLIC_BASE_PATH ?? ''}
    >
      {children}
    </AppShellClient>
  );
}
