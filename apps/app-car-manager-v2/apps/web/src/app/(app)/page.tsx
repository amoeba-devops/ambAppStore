import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-current-user';

/* Root route — role-aware landing.
 *
 * Schedule Dashboard (REQ-20260522) reintroduced a calendar-centric hub for
 * Admin/Manager — they land at `/dashboard` (booking + browse in one view).
 * Driver still lands at `/today` (PWA-first daily card).
 *
 * Middleware deflects drivers from any non-allowlisted path early, but we
 * keep the role branch in this page too so a direct hit to `/` (PWA splash,
 * browser bookmark, deep link from email) still lands on the right surface
 * even if middleware is bypassed (e.g. local dev). */
export default async function RootRedirect() {
  const user = await getCurrentUser();
  redirect(user.role === 'DRIVER' ? '/today' : '/dashboard');
}
