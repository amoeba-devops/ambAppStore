'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, ChevronRight, ChevronLeft, MapPin, Calendar, Car, Clock } from 'lucide-react';
import {
  Badge,
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Spinner,
} from '@car-v2/ui';
import { MapPreview } from '@/components/inputs/map-preview';

export interface DeleteWarning {
  type: string;
  count: number;
  message: string;
  /** Clickable refs - max 3 shown */
  refs?: {
    id: string;
    /** Primary label (e.g., trip ref "TRP-001") */
    label: string;
    /** Secondary info (e.g., "May 15 · HCM → Biên Hòa") */
    subtitle?: string;
    /** Link to detail page */
    href?: string;
    /** For trip refs - pickup address for map display */
    pickupAddress?: string;
    /** For trip refs - dropoff address for map display */
    dropoffAddress?: string;
    /** Trip status for badge display */
    status?: string;
    /** Scheduled time */
    scheduledAt?: string;
  }[];
}

/** Ref with type info for detail rendering */
export interface DeleteWarningRef {
  id: string;
  label: string;
  subtitle?: string;
  href?: string;
  type: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  status?: string;
  scheduledAt?: string;
}

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  /** Async function to fetch warnings when dialog opens */
  fetchWarnings?: () => Promise<DeleteWarning[]>;
  /** Labels for warning messages */
  warningLabels?: {
    loading?: string;
    hasWarnings?: string;
    noWarnings?: string;
    more?: (count: number) => string;
    /** Sidebar header for related items */
    relatedTitle?: string;
    /** "View full details" button label */
    viewFullDetails?: string;
    /** Translate trip status (e.g., "IN_PROGRESS" → "In Progress") */
    tripStatus?: (status: string) => string;
  };
  /** Locale for date/time formatting (e.g., "vi", "ko", "en") */
  locale?: string;
  /** Render detail view for a ref (opens in slide panel). If not provided, refs open in new tab. */
  renderRefDetail?: (ref: DeleteWarningRef) => React.ReactNode;
}

/**
 * A reusable confirmation dialog for destructive actions (delete, remove).
 * Uses Radix Dialog which works properly when embedded in AMA iframe.
 *
 * Features:
 * - Center modal with overlay
 * - Optional warnings with clickable ref cards
 * - Ref cards show label + subtitle (e.g., trip date/route)
 * - While busy, all dismissals are blocked
 */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Remove',
  cancelLabel = 'Cancel',
  onConfirm,
  fetchWarnings,
  warningLabels,
  renderRefDetail,
  locale,
}: ConfirmDeleteDialogProps) {
  const [busy, setBusy] = useState(false);
  const [loadingWarnings, setLoadingWarnings] = useState(false);
  const [warnings, setWarnings] = useState<DeleteWarning[]>([]);
  const [selectedRef, setSelectedRef] = useState<DeleteWarningRef | null>(null);
  // Separate state for sidebar inline detail (trip with map)
  const [sidebarSelectedTrip, setSidebarSelectedTrip] = useState<DeleteWarningRef | null>(null);

  // Fetch warnings when dialog opens
  useEffect(() => {
    if (open && fetchWarnings) {
      setLoadingWarnings(true);
      setWarnings([]);
      fetchWarnings()
        .then(setWarnings)
        .catch(() => setWarnings([]))
        .finally(() => setLoadingWarnings(false));
    }
    if (!open) {
      setWarnings([]);
      setSelectedRef(null);
      setSidebarSelectedTrip(null);
    }
  }, [open, fetchWarnings]);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // onConfirm threw without completing — let user retry
    } finally {
      setBusy(false);
    }
  };

  // Convert locale to BCP-47 format for date formatting
  const bcp47Locale = locale === 'ko' ? 'ko-KR' : locale === 'vi' ? 'vi-VN' : 'en-US';

  const hasWarnings = warnings.length > 0;
  // Check if any warning has trip refs (for showing sidebar layout)
  const tripRefs = warnings.flatMap((w) =>
    (w.type === 'active_trips' || w.type === 'linked_trip') && w.refs ? w.refs.map((r) => ({ ...r, type: w.type })) : []
  );
  const hasTripRefs = tripRefs.length > 0;
  // Non-trip warnings (expenses, attachments, etc.)
  const otherWarnings = warnings.filter((w) => w.type !== 'active_trips' && w.type !== 'linked_trip');

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent
        size={hasTripRefs ? 'lg' : 'md'}
        className="max-h-[85vh] overflow-hidden p-0"
        onEscapeKeyDown={(e) => busy && e.preventDefault()}
        onInteractOutside={(e) => busy && e.preventDefault()}
      >
        <div className={cn('flex flex-col md:flex-row', hasTripRefs && 'min-h-[400px]')}>
          {/* Main content - left side */}
          <div className={cn('flex-1 flex flex-col p-6', hasTripRefs && 'md:border-r md:border-border')}>
            <DialogHeader>
              <DialogTitle className="break-words">{title}</DialogTitle>
              <DialogDescription className="break-words">{description}</DialogDescription>
            </DialogHeader>

            {/* Warning section - compact when sidebar exists */}
            {fetchWarnings && (
              <div className="mt-4 rounded-lg border border-border bg-surface-2/50 p-3">
                {loadingWarnings ? (
                  <div className="flex items-center gap-2 text-text-muted text-sm">
                    <Spinner className="h-4 w-4 shrink-0" />
                    <span>{warningLabels?.loading ?? 'Checking...'}</span>
                  </div>
                ) : hasWarnings ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-warning font-medium text-sm">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>{warningLabels?.hasWarnings ?? 'Warning'}</span>
                    </div>
                    {/* Show trip count summary when sidebar exists */}
                    {hasTripRefs && (
                      <p className="text-text-muted text-xs">
                        {warnings.find((w) => w.type === 'active_trips' || w.type === 'linked_trip')?.message}
                      </p>
                    )}
                    {/* Show other warnings inline */}
                    {otherWarnings.map((w, i) => (
                      <div key={i}>
                        <p className="text-text-muted text-xs mb-1.5">{w.message}</p>
                        {w.refs && w.refs.length > 0 && (
                          <div className="space-y-1.5">
                            {w.refs.map((ref) => (
                              <button
                                key={ref.id}
                                type="button"
                                className="w-full flex items-center justify-between gap-2 p-2 rounded-md bg-surface hover:bg-surface-2 active:bg-surface-3 transition-colors touch-manipulation group text-left"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRef({ ...ref, type: w.type });
                                }}
                              >
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-text truncate">
                                    {ref.label}
                                  </div>
                                  {ref.subtitle && (
                                    <div className="text-xs text-text-muted truncate">
                                      {ref.subtitle}
                                    </div>
                                  )}
                                </div>
                                <ChevronRight className="h-4 w-4 shrink-0 text-text-faint group-hover:text-text-muted transition-colors" />
                              </button>
                            ))}
                            {w.count > 3 && (
                              <p className="text-text-faint text-xs pl-2">
                                {warningLabels?.more?.(w.count - 3) ?? `+${w.count - 3} more`}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    {/* Show inline refs only when no sidebar */}
                    {!hasTripRefs && warnings.filter((w) => w.type === 'active_trips' || w.type === 'linked_trip').map((w, i) => (
                      <div key={`trip-${i}`}>
                        <p className="text-text-muted text-xs mb-1.5">{w.message}</p>
                        {w.refs && w.refs.length > 0 && (
                          <div className="space-y-1.5">
                            {w.refs.map((ref) => (
                              <button
                                key={ref.id}
                                type="button"
                                className="w-full flex items-center justify-between gap-2 p-2 rounded-md bg-surface hover:bg-surface-2 active:bg-surface-3 transition-colors touch-manipulation group text-left"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRef({ ...ref, type: w.type });
                                }}
                              >
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-text truncate">
                                    {ref.label}
                                  </div>
                                  {ref.subtitle && (
                                    <div className="text-xs text-text-muted truncate">
                                      {ref.subtitle}
                                    </div>
                                  )}
                                </div>
                                <ChevronRight className="h-4 w-4 shrink-0 text-text-faint group-hover:text-text-muted transition-colors" />
                              </button>
                            ))}
                            {w.count > 3 && (
                              <p className="text-text-faint text-xs pl-2">
                                {warningLabels?.more?.(w.count - 3) ?? `+${w.count - 3} more`}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-success text-sm">
                    <span>✓ {warningLabels?.noWarnings ?? 'No active assignments'}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex-1" />

            <DialogFooter className="mt-6">
              <Button
                variant="secondary"
                size="md"
                className="w-full sm:w-auto"
                onClick={() => onOpenChange(false)}
                disabled={busy}
              >
                {cancelLabel}
              </Button>
              <Button
                variant="danger"
                size="md"
                className="w-full sm:w-auto"
                iconLeft={<Trash2 />}
                loading={busy}
                disabled={loadingWarnings}
                onClick={handleConfirm}
              >
                {confirmLabel}
              </Button>
            </DialogFooter>
          </div>

          {/* Trip sidebar - right side on desktop, bottom section on mobile */}
          {hasTripRefs && (
            <aside className="flex flex-col md:w-[320px] bg-surface-2/30 overflow-hidden border-t md:border-t-0 md:border-l border-border max-h-[200px] md:max-h-none">
              {/* Sidebar header */}
              <div className="px-4 py-3 border-b border-border bg-surface/50">
                {sidebarSelectedTrip ? (
                  <button
                    type="button"
                    className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wider hover:text-text transition-colors"
                    onClick={() => setSidebarSelectedTrip(null)}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    {warningLabels?.relatedTitle ?? 'Related Trips'}
                  </button>
                ) : (
                  <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" />
                    {warningLabels?.relatedTitle ?? 'Related Trips'}
                  </h3>
                )}
              </div>

              {/* Sidebar content */}
              <div className="flex-1 overflow-y-auto">
                {sidebarSelectedTrip ? (
                  /* Inline trip detail with map */
                  <div className="p-4 space-y-4">
                    {/* Trip header */}
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                        <Car className="h-5 w-5 text-warning" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-text">{sidebarSelectedTrip.label}</div>
                        {sidebarSelectedTrip.status && (
                          <Badge
                            tone={
                              sidebarSelectedTrip.status === 'IN_PROGRESS' ? 'info' :
                              sidebarSelectedTrip.status === 'CONFIRMED' ? 'success' :
                              sidebarSelectedTrip.status === 'PENDING_DRIVER_CONFIRMATION' ? 'warning' : 'neutral'
                            }
                            size="sm"
                            className="mt-1"
                          >
                            {warningLabels?.tripStatus?.(sidebarSelectedTrip.status) ?? sidebarSelectedTrip.status.replace(/_/g, ' ')}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Scheduled time */}
                    {sidebarSelectedTrip.scheduledAt && (
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {new Date(sidebarSelectedTrip.scheduledAt).toLocaleString(bcp47Locale, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>
                    )}

                    {/* Route addresses */}
                    {(sidebarSelectedTrip.pickupAddress || sidebarSelectedTrip.dropoffAddress) && (
                      <div className="space-y-2 text-xs">
                        {sidebarSelectedTrip.pickupAddress && (
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 h-2 w-2 rounded-full bg-accent shrink-0" />
                            <span className="text-text-muted leading-relaxed">{sidebarSelectedTrip.pickupAddress}</span>
                          </div>
                        )}
                        {sidebarSelectedTrip.dropoffAddress && (
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 h-2 w-2 rounded-full bg-success shrink-0" />
                            <span className="text-text-muted leading-relaxed">{sidebarSelectedTrip.dropoffAddress}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Map preview */}
                    {sidebarSelectedTrip.pickupAddress && sidebarSelectedTrip.dropoffAddress && (
                      <MapPreview
                        pickup={sidebarSelectedTrip.pickupAddress}
                        dropoff={sidebarSelectedTrip.dropoffAddress}
                        className="rounded-lg overflow-hidden"
                        heightClassName="h-[180px]"
                      />
                    )}

                    {/* View full detail button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => setSelectedRef(sidebarSelectedTrip)}
                    >
                      {warningLabels?.viewFullDetails ?? 'View full details'}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                ) : (
                  /* Trip list */
                  <>
                    <div className="divide-y divide-border">
                      {tripRefs.map((ref) => (
                        <button
                          key={ref.id}
                          type="button"
                          className="w-full p-3 hover:bg-surface active:bg-surface-2 transition-colors text-left group"
                          onClick={(e) => {
                            e.stopPropagation();
                            // If ref has addresses, show inline detail; otherwise open Sheet
                            if (ref.pickupAddress && ref.dropoffAddress) {
                              setSidebarSelectedTrip(ref as DeleteWarningRef);
                            } else {
                              setSelectedRef(ref as DeleteWarningRef);
                            }
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-md bg-warning/10 flex items-center justify-center shrink-0">
                              <Car className="h-4 w-4 text-warning" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-text truncate">
                                {ref.label}
                              </div>
                              {ref.subtitle && (
                                <div className="text-xs text-text-muted mt-0.5 line-clamp-2">
                                  {ref.subtitle}
                                </div>
                              )}
                            </div>
                            <ChevronRight className="h-4 w-4 shrink-0 text-text-faint group-hover:text-text-muted transition-colors mt-0.5" />
                          </div>
                        </button>
                      ))}
                    </div>
                    {(warnings.find((w) => w.type === 'active_trips')?.count ?? 0) > tripRefs.length && (
                      <div className="px-4 py-2 text-xs text-text-faint">
                        {warningLabels?.more?.((warnings.find((w) => w.type === 'active_trips')?.count ?? 0) - tripRefs.length) ?? `+${(warnings.find((w) => w.type === 'active_trips')?.count ?? 0) - tripRefs.length} more`}
                      </div>
                    )}
                  </>
                )}
              </div>
            </aside>
          )}
        </div>
      </DialogContent>

      {/* Detail slide panel */}
      <Sheet open={!!selectedRef} onOpenChange={(o) => !o && setSelectedRef(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedRef?.label}</SheetTitle>
            {selectedRef?.subtitle && (
              <SheetDescription>{selectedRef.subtitle}</SheetDescription>
            )}
          </SheetHeader>
          <div className="mt-4">
            {selectedRef && renderRefDetail?.(selectedRef)}
          </div>
        </SheetContent>
      </Sheet>
    </Dialog>
  );
}
