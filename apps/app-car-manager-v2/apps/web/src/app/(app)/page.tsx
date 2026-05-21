import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-current-user';

/* Root route — role-aware landing.
 *
 * Module 3 (Dashboard & Reports) was removed per updated user-flow. Without a
 * KPI dashboard at `/`, both roles need a deterministic landing target:
 *   - DRIVER  → `/today`  (assigned trips + state-aware CTA)
 *   - STAFF   → `/trips`  (fleet trip queue — primary admin workflow)
 *
 * Middleware also performs the DRIVER redirect early to skip the cookie read
 * here, but we keep the role branch in the page so direct navigation to `/`
 * (e.g. PWA splash, browser bookmark) lands correctly even if middleware is
 * bypassed (e.g. local dev). */
export default async function RootRedirect() {
  const user = await getCurrentUser();
  redirect(user.role === 'DRIVER' ? '/today' : '/trips');
}
