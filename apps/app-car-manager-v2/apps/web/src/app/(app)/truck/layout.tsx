import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { hasFleet } from '@/lib/auth/fleet-access';

/**
 * Truck workspace layout. Gates the whole `/truck/*` subtree to users with
 * TRUCK fleet access (ADMIN implicitly). Drivers are routed to their own
 * surface; managers without truck access bounce to the car dashboard.
 *
 * The orange accent theme (`--accent` override in tokens.css) is driven by
 * `DeptProvider` → `DeptThemeEffect` which sets `data-dept="truck"` on <html>
 * after hydration. On repeat visits `app/layout.tsx` pre-renders the attribute
 * from the `ccms.fleet.dept` cookie, avoiding the blue→orange flash entirely.
 */
export default async function TruckLayout({ children }: { children: React.ReactNode }) {
  const actor = await getCurrentUser();
  if (actor.role === 'DRIVER') redirect('/today');
  if (!(await hasFleet(actor, 'TRUCK'))) redirect('/dashboard');

  return <>{children}</>;
}
