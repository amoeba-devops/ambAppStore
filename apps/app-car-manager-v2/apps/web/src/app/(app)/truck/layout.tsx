import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { hasFleet } from '@/lib/auth/fleet-access';
import { DeptThemeEffect } from '@/components/layout/dept-theme-effect';

/**
 * Truck workspace layout (REQ-20260617). Gates the whole `/truck/*` subtree to
 * users with TRUCK department access (ADMIN implicitly) and applies the orange
 * department theme while mounted. Drivers never reach here (they use the driver
 * surface); managers without truck access are bounced to the car dashboard.
 */
export default async function TruckLayout({ children }: { children: React.ReactNode }) {
  const actor = await getCurrentUser();
  if (actor.role === 'DRIVER') redirect('/today');
  if (!(await hasFleet(actor, 'TRUCK'))) redirect('/dashboard');

  return (
    <>
      <DeptThemeEffect dept="TRUCK" />
      {children}
    </>
  );
}
