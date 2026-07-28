'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

const STORAGE_KEY = 'ccms.oil-banner.dismissed';

export interface CriticalAlertItem {
  alertId: string;
  vehiclePlate: string;
  /** Only the CRITICAL types reach the banner — deriveAlertCandidates assigns
   * CRITICAL to exactly these two. */
  type: 'OIL_OVERDUE' | 'INSPECTION_OVERDUE';
}

/**
 * Sticky-top banner showing the most urgent CRITICAL maintenance alerts.
 * Per REQ-20260519 Q7: visible to Admin/Manager on every page when unresolved
 * CRITICAL alerts exist. Dismissible per session via localStorage so users
 * can navigate without the banner consuming vertical space.
 *
 * Server-driven: the parent layout fetches CRITICAL alerts via
 * getCriticalUnresolvedAlerts(entId) and passes a serialized list down.
 * Empty list → banner renders nothing.
 */
export function OilOverdueBanner({ items }: { items: CriticalAlertItem[] }) {
  const t = useTranslations('maintenance.banner');
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setDismissedIds(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore */
    }
  }, []);

  const visible = items.filter((it) => !dismissedIds.has(it.alertId));
  if (visible.length === 0) return null;
  const first = visible[0]!;
  const extraCount = visible.length - 1;

  function dismiss() {
    const next = new Set(dismissedIds);
    for (const it of visible) next.add(it.alertId);
    setDismissedIds(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="sticky top-0 z-30 bg-danger text-danger-fg">
      <div className="px-4 md:px-6 py-2 flex items-center gap-3">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        {/* Both links land on the alert list. They previously pointed at
         * /vehicles?alert=… and /today — placeholders from when Module 2 had no
         * screen of its own; neither destination did anything with the alert. */}
        <Link href="/maintenance" className="text-sm font-medium truncate hover:underline">
          {t(`label_${first.type}`, { plate: first.vehiclePlate })}
          {extraCount > 0 && <span className="ml-2 opacity-80">+{extraCount}</span>}
        </Link>
        <Link
          href="/maintenance"
          className="text-xs underline-offset-2 hover:underline ml-auto hidden md:inline"
        >
          {t('viewAll')}
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="p-1 hover:bg-black/10 rounded"
          aria-label={t('dismiss')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
