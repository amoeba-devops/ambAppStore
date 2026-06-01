'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardHeaderText,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from '@car-v2/ui';
import type { CarTripStatus } from '@car-v2/db/schema';
import type { TripListItem } from '@/server/queries/trips.queries';
import { useTripViewMode } from '@/hooks/use-trip-view-mode';
import { TripBoard } from './trip-board';
import { BoardViewport } from './board-viewport';
import { TripViewSwitch } from './trip-view-switch';

const STATUS_TONE: Record<CarTripStatus, 'accent' | 'warning' | 'success' | 'info' | 'neutral' | 'danger'> = {
  PENDING_ASSIGNMENT: 'accent',
  PENDING_DRIVER_CONFIRMATION: 'warning',
  CONFIRMED: 'success',
  IN_PROGRESS: 'info',
  COMPLETED: 'neutral',
  REJECTED_BY_DRIVER: 'danger',
  CANCELLED: 'danger',
};

interface TripHistorySectionProps {
  trips: TripListItem[];
  /** `driver` page shows a Vehicle column; `vehicle` page shows a Driver column. */
  variant: 'driver' | 'vehicle';
  /** Section heading (page-contextual, e.g. "Recent trips"). */
  title: string;
  /** Message when there are no trips. */
  emptyLabel: string;
}

/**
 * Trip history block used on the driver & vehicle detail pages. Same data,
 * two renderings (Kanban by status / table) toggled via the shared
 * session-scoped view mode. Kanban is the default; the choice carries across
 * all trip surfaces.
 *
 * The trips are already scoped to one driver/vehicle by the server query, so
 * the Kanban here visualises where THAT entity's trips sit in the pipeline.
 */
export function TripHistorySection({ trips, variant, title, emptyLabel }: TripHistorySectionProps) {
  const tBoard = useTranslations('trips.board');
  const tStatus = useTranslations('trips.status');
  const [mode, setMode] = useTripViewMode();

  const otherCol = variant === 'driver' ? tBoard('thVehicle') : tBoard('thDriver');

  /* Board fills the remaining viewport height on md+ (desktop detail pages);
   * on mobile it keeps a natural/capped height so the page can still scroll to
   * the cards that sit below it (driver notes, vehicle doc tabs). */
  const isBoard = trips.length > 0 && mode === 'kanban';

  const section = (
    <Card className={cn(isBoard && 'md:flex md:h-full md:flex-col md:min-w-0')}>
      <CardHeader>
        <CardHeaderText>
          <CardTitle>{title}</CardTitle>
        </CardHeaderText>
        {trips.length > 0 && <TripViewSwitch value={mode} onChange={setMode} />}
      </CardHeader>

      {trips.length === 0 ? (
        <CardContent>
          <div className="py-6 text-center text-sm text-text-muted">{emptyLabel}</div>
        </CardContent>
      ) : mode === 'kanban' ? (
        <CardContent padded={false} className="p-3 min-w-0 md:flex-1 md:min-h-0">
          <TripBoard trips={trips} mode="detail" edgeBleed={false} fillHeight="md" />
        </CardContent>
      ) : (
        <CardContent padded={false}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tBoard('thRef')}</TableHead>
                <TableHead>{tBoard('thWhen')}</TableHead>
                <TableHead>{tBoard('thRoute')}</TableHead>
                <TableHead>{otherCol}</TableHead>
                <TableHead>{tBoard('thStatus')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trips.map((r) => (
                <TableRow key={r.trpId}>
                  <TableCell>
                    <Link
                      href={`/trips/${r.trpId}`}
                      className="font-mono text-xs text-accent hover:underline tabular"
                    >
                      {r.trpRef}
                    </Link>
                  </TableCell>
                  <TableCell className="text-text-muted tabular">
                    {new Date(r.trpScheduledAt).toISOString().slice(0, 10)}
                  </TableCell>
                  <TableCell className="max-w-[260px] truncate">
                    {r.trpPickupAddress} → {r.trpDropoffAddress}
                  </TableCell>
                  <TableCell className={variant === 'driver' ? 'font-mono text-xs tabular' : undefined}>
                    {variant === 'driver' ? (r.vehiclePlate ?? '—') : (r.driverName ?? '—')}
                  </TableCell>
                  <TableCell>
                    <Badge tone={STATUS_TONE[r.trpStatus]} size="sm">
                      {tStatus(r.trpStatus)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      )}
    </Card>
  );

  /* Only the full-height board needs the measured viewport wrapper; the table
   * and empty states flow at natural height inside the document scroll. */
  return isBoard ? (
    <BoardViewport desktopOnly className="md:flex md:flex-col">
      {section}
    </BoardViewport>
  ) : (
    section
  );
}
