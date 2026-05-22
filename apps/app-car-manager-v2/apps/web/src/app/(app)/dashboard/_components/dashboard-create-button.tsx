'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Button } from '@car-v2/ui';

/**
 * Tiny Client button rendered in the dashboard PageHeader (Server) actions
 * slot. Setting `?create=1` is the cross-boundary signal that DashboardShell
 * (also Client) listens for to open the TripFormDialog. URL-as-state lets the
 * Server PageHeader stay async-friendly (Breadcrumbs + getTranslations) while
 * the Client shell owns the dialog.
 *
 * Icon + label mirror the TripsListPanel "+ Create" affordance so both surfaces
 * read as the same action (just at different button sizes).
 */
export function DashboardCreateButton() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('dashboard.form');

  const handleClick = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('create', '1');
    router.push(`/dashboard?${params.toString()}`, { scroll: false });
  };

  return (
    <Button type="button" variant="accent" size="md" onClick={handleClick} iconLeft={<Plus />}>
      {t('titleCreate')}
    </Button>
  );
}
