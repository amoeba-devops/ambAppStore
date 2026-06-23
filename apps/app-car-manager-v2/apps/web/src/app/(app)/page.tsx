import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { resolveFleetAccess } from '@/lib/auth/fleet-access';

/* Root route — role + dept aware landing.
 *
 * Driver → /today (PWA-first daily card).
 * Admin/Manager → /truck/dashboard if their active/default workspace is TRUCK,
 *                 otherwise /dashboard (CAR calendar hub).
 *
 * Resolution mirrors app-shell.tsx `initialDept` logic exactly so the
 * landing page and the sidebar active-workspace are always in sync:
 *   1. cookie 'TRUCK'  + user has TRUCK access  → /truck/dashboard
 *   2. cookie 'CAR'    + user has CAR access    → /dashboard
 *   3. no/invalid cookie                         → first dept in fleetAccess
 *      (ADMIN / mgr-both → CAR first; mgr-truck → TRUCK)
 *
 * Middleware deflects drivers from any non-allowlisted path early, but we
 * keep the role branch here too so a direct hit to `/` (PWA splash, browser
 * bookmark, deep link from email) still lands correctly even when middleware
 * is bypassed (e.g. local dev). */
export default async function RootRedirect() {
  const user = await getCurrentUser();
  if (user.role === 'DRIVER') redirect('/today');

  const [fleetAccess, jar] = await Promise.all([resolveFleetAccess(user), cookies()]);
  const cookieDept = jar.get('ccms.fleet.dept')?.value;

  const preferredDept =
    cookieDept === 'TRUCK' && fleetAccess.includes('TRUCK')
      ? 'TRUCK'
      : cookieDept === 'CAR' && fleetAccess.includes('CAR')
        ? 'CAR'
        : (fleetAccess[0] ?? 'CAR');

  redirect(preferredDept === 'TRUCK' ? '/truck/dashboard' : '/dashboard');
}
