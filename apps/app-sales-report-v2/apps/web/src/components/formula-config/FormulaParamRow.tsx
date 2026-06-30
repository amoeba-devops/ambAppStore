'use client';

import { useState } from 'react';
import { Check, Edit3, History, Loader2, X } from 'lucide-react';
import { cn } from '@v2/ui';
import type { FormulaParamSpec } from '@v2/shared';
import { updateFormulaConfigAction } from '@/server/actions/formula-config.actions';
import { FormulaParamHistoryDrawer } from './FormulaParamHistoryDrawer';

interface Props {
  spec: FormulaParamSpec;
  currentValue: string;
  effectiveFrom: string; // ISO timestamp
  /** Admin-only — when false, render read-only. */
  canEdit: boolean;
  onSaved?: () => void;
}

/**
 * One editable row in the FR-23 server-backed params section. Renders the
 * current value + Edit button. On Edit, switches to an inline form (input
 * control matching the spec's valueType + an effective-date picker) + Save /
 * Cancel. On Save, calls `updateFormulaConfigAction` and re-fetches via
 * `onSaved`.
 */
export function FormulaParamRow({ spec, currentValue, effectiveFrom, canEdit, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(currentValue);
  const [draftEffective, setDraftEffective] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const displayValue = formatDisplay(spec, currentValue);
  const effectiveDate = new Date(effectiveFrom).toISOString().slice(0, 10);

  const onCancel = () => {
    setEditing(false);
    setError(null);
    setDraftValue(currentValue);
  };

  const onSave = async () => {
    setSaving(true);
    setError(null);
    const res = await updateFormulaConfigAction({
      key: spec.key,
      value: draftValue,
      effectiveFrom: new Date(draftEffective + 'T00:00:00Z').toISOString(),
      sourceNote: note || undefined,
    });
    setSaving(false);
    if (!res.success) {
      setError(res.error.message);
      return;
    }
    setEditing(false);
    setNote('');
    onSaved?.();
  };

  return (
    <>
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-neutral-900">{spec.displayName}</span>
              <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500">
                {spec.key}
              </code>
            </div>
            <p className="mt-1 text-xs text-neutral-500">{spec.description}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
              title="View history"
            >
              <History className="h-3.5 w-3.5" />
              History
            </button>
            {canEdit && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1 rounded-md border border-info-500 bg-info-50 px-2.5 py-1 text-xs font-medium text-info-500 hover:bg-info-100"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Edit
              </button>
            )}
          </div>
        </div>

        {!editing && (
          <div className="mt-3 flex items-baseline gap-3">
            <span className="font-mono text-lg font-semibold text-neutral-900">{displayValue}</span>
            <span className="text-xs text-neutral-500">Effective from {effectiveDate}</span>
            {!canEdit && (
              <span className="ml-auto rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] uppercase tracking-wider text-neutral-500">
                Read only
              </span>
            )}
          </div>
        )}

        {editing && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-neutral-500">New value</span>
              <div className="flex items-center gap-2">
                {renderInput(spec, draftValue, setDraftValue, saving)}
                {spec.unit && <span className="text-sm text-neutral-500">{spec.unit}</span>}
              </div>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-neutral-500">Effective from</span>
              <input
                type="date"
                value={draftEffective}
                onChange={(e) => setDraftEffective(e.target.value)}
                disabled={saving}
                className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm font-mono tabular-nums focus:border-info-500 focus:outline-none"
              />
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                  saving
                    ? 'border-neutral-200 bg-neutral-50 text-neutral-400'
                    : 'border-success-500 bg-success-50 text-success-500 hover:bg-success-100',
                )}
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Save
              </button>
              <button
                type="button"
                onClick={onCancel}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
            </div>
            <label className="col-span-full flex flex-col gap-1 text-xs">
              <span className="text-neutral-500">Note (optional)</span>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={saving}
                maxLength={255}
                placeholder="Why is this changing? (audit trail)"
                className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-info-500 focus:outline-none"
              />
            </label>
            {error && (
              <div className="col-span-full rounded-md border border-error-500 bg-error-50 px-3 py-2 text-xs text-error-500">
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      {historyOpen && (
        <FormulaParamHistoryDrawer
          spec={spec}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </>
  );
}

function formatDisplay(spec: FormulaParamSpec, value: string): string {
  switch (spec.valueType) {
    case 'percentage':
      return `${value}${spec.unit ?? '%'}`;
    case 'currency':
      return `${Number(value).toLocaleString('en-US')} ${spec.unit ?? 'VND'}`;
    case 'date':
      return new Date(value).toISOString().slice(0, 10);
    case 'numeric':
      return value;
    case 'enum':
      return value;
  }
}

function renderInput(
  spec: FormulaParamSpec,
  value: string,
  onChange: (v: string) => void,
  disabled: boolean,
) {
  const base =
    'rounded-md border border-neutral-300 px-2 py-1.5 text-sm font-mono tabular-nums focus:border-info-500 focus:outline-none disabled:opacity-50';
  switch (spec.valueType) {
    case 'numeric':
    case 'percentage':
    case 'currency':
      return (
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`${base} w-32`}
        />
      );
    case 'date':
      return (
        <input
          type="date"
          value={value.slice(0, 10)}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`${base} w-40`}
        />
      );
    case 'enum':
      return (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`${base} w-56`}
        >
          {(spec.enumOptions ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
  }
}
