import { redirect } from 'next/navigation';

/**
 * Truck fixed-cost config was folded into the unified "Chi phí & Lợi nhuận"
 * screen (REQ-20260623 G4). Kept as a redirect so old links/bookmarks resolve.
 */
export default function TruckSettingsRedirect() {
  redirect('/truck/pnl');
}
