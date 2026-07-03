'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import {
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  cn,
} from '@car-v2/ui';

const FIELD_LABELS: Record<string, string> = {
  status: 'fldStatus',
  plate: 'fldPlate',
  model: 'fldModel',
  transition: 'fldTransition',
  type: 'fldType',
  amount: 'fldAmount',
  fileName: 'fldFileName',
  count: 'fldCount',
  month: 'fldMonth',
  region: 'fldRegion',
  vehicleType: 'fldVehicleType',
  reason: 'fldReason',
  lastOilChangeKm: 'fldLastOilKm',
  vehicleId: 'fldVehicleId',
  overriddenConflicts: 'fldConflicts',
  salary: 'fldSalary',
  depreciation: 'fldDepreciation',
  lastOilChangeDate: 'fldLastOilDate',
  odometer: 'fldOdometer',
  consumption: 'fldConsumption',
  avgPrice: 'fldAvgPrice',
  reopenReason: 'fldReopenReason',
};

const STATUS_ENUMS = new Set([
  'PENDING_ASSIGNMENT',
  'PENDING_DRIVER_CONFIRMATION',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'REJECTED_BY_DRIVER',
]);

const EXPENSE_STATUS_ENUMS = new Set([
  'PENDING',
  'AUTO_APPROVED',
  'APPROVED',
  'REJECTED',
]);

const VEHICLE_STATUS = new Set(['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED']);

const EXPENSE_TYPES = new Set([
  'FUEL',
  'OIL',
  'MEAL',
  'REPAIR',
  'PARKING',
  'TOLL',
  'ACCIDENT',
  'INSPECTION',
]);

interface ChangeLine {
  key: string;
  label: string;
  oldVal: string | null;
  newVal: string | null;
  isUpdate: boolean;
}

function isNumericAmount(v: unknown): v is number {
  return typeof v === 'number' && v >= 1000 && !Number.isInteger(Math.log10(v));
}

interface Props {
  before: unknown;
  after: unknown;
  action: string;
  entityRef: string | null;
  actorName: string | null;
  timestamp: string;
}

export function AuditContentCell({
  before,
  after,
  action,
  entityRef,
  actorName,
  timestamp,
}: Props) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('audit');

  const lines = buildChangeLines(before, after, t);
  if (lines.length === 0) return <span className="text-text-faint">—</span>;

  const MAX_INLINE = 3;
  const hasMore = lines.length > MAX_INLINE;
  const visible = hasMore ? lines.slice(0, MAX_INLINE) : lines;

  return (
    <>
      <div className="max-w-[24rem] space-y-0.5">
        {visible.map((line, i) => (
          <InlineLine key={i} line={line} />
        ))}
        {hasMore && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-0.5 text-[11px] text-accent hover:underline mt-0.5"
          >
            {t('showMore', { count: lines.length - MAX_INLINE })}
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Detail dialog for full change list */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg" className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('detailTitle')}</DialogTitle>
            <DialogDescription>
              <Badge tone="neutral" size="sm" className="font-mono">
                {action}
              </Badge>
              {entityRef && (
                <span className="ml-2 font-mono text-xs">{entityRef}</span>
              )}
              {actorName && (
                <span className="ml-2 text-text-muted">— {actorName}</span>
              )}
              <span className="ml-2 text-text-faint text-xs font-mono tabular">
                {timestamp}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
            {lines.map((line, i) => (
              <div
                key={i}
                className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-baseline sm:gap-3"
              >
                <span className="shrink-0 text-xs font-semibold text-text-muted w-32">
                  {line.label}
                </span>
                <div className="flex-1 text-sm text-text break-all">
                  {line.isUpdate ? (
                    <>
                      <span className="text-danger/70 line-through">
                        {line.oldVal ?? '∅'}
                      </span>
                      <span className="mx-1.5 text-text-faint">→</span>
                      <span className="text-success font-medium">
                        {line.newVal ?? '∅'}
                      </span>
                    </>
                  ) : (
                    <span>{line.newVal ?? line.oldVal ?? '∅'}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function InlineLine({ line }: { line: ChangeLine }) {
  return (
    <div className="text-[11px] leading-snug">
      <span className="font-medium text-text-muted">{line.label}: </span>
      {line.isUpdate ? (
        <>
          <span className="text-danger/70 line-through">{line.oldVal ?? '∅'}</span>
          <span className="mx-1 text-text-faint">→</span>
          <span className="text-success">{line.newVal ?? '∅'}</span>
        </>
      ) : (
        <span className="text-text">{line.newVal ?? line.oldVal ?? '∅'}</span>
      )}
    </div>
  );
}

function buildChangeLines(
  before: unknown,
  after: unknown,
  t: ReturnType<typeof useTranslations>,
): ChangeLine[] {
  const b =
    before && typeof before === 'object'
      ? (before as Record<string, unknown>)
      : null;
  const a =
    after && typeof after === 'object'
      ? (after as Record<string, unknown>)
      : null;

  const lines: ChangeLine[] = [];

  const fmtVal = (v: unknown): string => {
    if (v == null) return '∅';
    if (typeof v === 'number') {
      if (isNumericAmount(v)) return v.toLocaleString() + ' ₫';
      return String(v);
    }
    if (typeof v === 'string') {
      if (STATUS_ENUMS.has(v)) return tryTranslate(t, `statusVal.${v}`, v);
      if (EXPENSE_STATUS_ENUMS.has(v)) return tryTranslate(t, `expStatusVal.${v}`, v);
      if (VEHICLE_STATUS.has(v)) return tryTranslate(t, `vehStatusVal.${v}`, v);
      if (EXPENSE_TYPES.has(v)) return tryTranslate(t, `expTypeVal.${v}`, v);
      return v;
    }
    if (Array.isArray(v)) return v.join(', ');
    return JSON.stringify(v);
  };

  const fieldLabel = (key: string): string => {
    const mapped = FIELD_LABELS[key];
    if (mapped) return tryTranslate(t, mapped, key);
    return key;
  };

  if (b && a) {
    for (const k of new Set([...Object.keys(b), ...Object.keys(a)])) {
      if (JSON.stringify(b[k]) !== JSON.stringify(a[k])) {
        lines.push({
          key: k,
          label: fieldLabel(k),
          oldVal: fmtVal(b[k]),
          newVal: fmtVal(a[k]),
          isUpdate: true,
        });
      }
    }
  } else if (a) {
    for (const [k, v] of Object.entries(a)) {
      lines.push({
        key: k,
        label: fieldLabel(k),
        oldVal: null,
        newVal: fmtVal(v),
        isUpdate: false,
      });
    }
  } else if (b) {
    for (const [k, v] of Object.entries(b)) {
      lines.push({
        key: k,
        label: fieldLabel(k),
        oldVal: fmtVal(v),
        newVal: null,
        isUpdate: false,
      });
    }
  }

  return lines;
}

function tryTranslate(
  t: ReturnType<typeof useTranslations>,
  key: string,
  fallback: string,
): string {
  try {
    const result = t(key);
    return result === key ? fallback : result;
  } catch {
    return fallback;
  }
}
