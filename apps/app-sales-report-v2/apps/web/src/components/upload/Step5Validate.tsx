'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@v2/ui';
import {
  validateAllFormulas,
  type MetricValidation,
  type ValidationIssue,
} from '@/lib/formula-validator';
import type { SelectedPeriod } from './Step1Period';

const VALUES_KEY = 'formula-config-values';
const SOURCES_KEY = 'formula-config-sources';

interface Props {
  selectedPeriod?: SelectedPeriod | null;
}

type FilterMode = 'errors' | 'warnings' | 'all';

export function Step5Validate({ selectedPeriod = null }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [sources, setSources] = useState<Record<string, string[]>>({});
  const [validatedAt, setValidatedAt] = useState<Date | null>(null);
  const [filter, setFilter] = useState<FilterMode>('errors');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Load from localStorage
  const readLocal = () => {
    try {
      const rawV = localStorage.getItem(VALUES_KEY);
      const rawS = localStorage.getItem(SOURCES_KEY);
      setValues(rawV ? JSON.parse(rawV) : {});
      setSources(rawS ? JSON.parse(rawS) : {});
      setValidatedAt(new Date());
    } catch {
      setValues({});
      setSources({});
      setValidatedAt(new Date());
    }
  };

  useEffect(() => {
    readLocal();
    const onStorage = (e: StorageEvent) => {
      if (e.key === VALUES_KEY || e.key === SOURCES_KEY) readLocal();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const summary = useMemo(() => validateAllFormulas(values, sources), [values, sources]);

  const filtered = useMemo(() => {
    return summary.results.filter((r) => {
      const hasError = r.issues.some((i) => i.severity === 'error');
      const hasWarn = r.issues.some((i) => i.severity === 'warning');
      if (filter === 'errors') return hasError;
      if (filter === 'warnings') return hasWarn && !hasError;
      return r.issues.length > 0;
    });
  }, [summary, filter]);

  // Group results by section title
  const grouped = useMemo(() => {
    const map = new Map<string, MetricValidation[]>();
    for (const r of filtered) {
      if (!map.has(r.sectionTitle)) map.set(r.sectionTitle, []);
      map.get(r.sectionTitle)!.push(r);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const allPass = summary.errorCount === 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Step 5 · Validate</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Static analysis of every formula: syntax, missing references, circular deps,
            divide-by-zero risk, datatype compatibility.
          </p>
        </div>
        <button
          type="button"
          onClick={readLocal}
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Re-run validation
        </button>
      </div>

      {selectedPeriod && (
        <div className="rounded-md bg-info-50/40 border border-info-500/30 px-3 py-2 text-xs text-info-500">
          Validating formulas applied to{' '}
          <span className="font-mono font-semibold">{selectedPeriod.label}</span>{' '}
          <span className="text-neutral-500">({selectedPeriod.rangeLabel})</span>.
        </div>
      )}

      {/* Summary banner */}
      <div
        className={cn(
          'rounded-lg border px-4 py-3 flex items-center gap-3',
          allPass
            ? 'border-success-500/30 bg-success-500/10'
            : 'border-error-500/30 bg-error-500/10',
        )}
      >
        {allPass ? (
          <ShieldCheck className="h-5 w-5 text-success-500 shrink-0" />
        ) : (
          <AlertCircle className="h-5 w-5 text-error-500 shrink-0" />
        )}
        <div className="flex-1">
          <div className={cn('text-sm font-semibold', allPass ? 'text-success-500' : 'text-error-500')}>
            {allPass
              ? `All ${summary.totalCount} formulas valid — safe to proceed`
              : `Validation failed — ${summary.errorCount} error${summary.errorCount > 1 ? 's' : ''} must be fixed before ingest`}
          </div>
          <div className="text-[11px] text-neutral-600 mt-0.5">
            {summary.validCount}/{summary.totalCount} valid · {summary.errorCount} error
            {summary.errorCount !== 1 && 's'} · {summary.warningCount} warning
            {summary.warningCount !== 1 && 's'}
            {validatedAt && (
              <>
                {' · '}last run {validatedAt.toLocaleTimeString()}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stat tiles + filter */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Valid"
          value={summary.validCount}
          tone="success"
          active={filter === 'all' && summary.errorCount === 0 && summary.warningCount === 0}
          onClick={() => setFilter('all')}
        />
        <StatTile
          icon={<AlertCircle className="h-4 w-4" />}
          label="Errors"
          value={summary.errorCount}
          tone="error"
          active={filter === 'errors'}
          onClick={() => setFilter('errors')}
        />
        <StatTile
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Warnings"
          value={summary.warningCount}
          tone="warning"
          active={filter === 'warnings'}
          onClick={() => setFilter('warnings')}
        />
      </div>

      {/* Results */}
      {grouped.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-10 text-center text-sm text-neutral-500">
          {filter === 'errors' && summary.errorCount === 0
            ? '🎉 No errors. All formulas pass strict validation.'
            : filter === 'warnings' && summary.warningCount === 0
              ? 'No warnings.'
              : 'No results match this filter.'}
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(([sectionTitle, items]) => (
            <div key={sectionTitle} className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
              <div className="bg-neutral-50/60 px-4 py-2 border-b border-neutral-100 text-[10px] uppercase tracking-wider font-semibold text-neutral-500 flex items-center justify-between">
                <span>{sectionTitle}</span>
                <span className="text-neutral-400">
                  {items.length} metric{items.length !== 1 && 's'}
                </span>
              </div>
              <div className="divide-y divide-neutral-100">
                {items.map((r) => (
                  <ResultRow
                    key={r.metric}
                    result={r}
                    expanded={expanded[r.metric] ?? true}
                    onToggle={() =>
                      setExpanded((s) => ({ ...s, [r.metric]: !(s[r.metric] ?? true) }))
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  tone,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: 'success' | 'error' | 'warning';
  active: boolean;
  onClick: () => void;
}) {
  const toneCls =
    tone === 'success'
      ? 'border-success-500/30 bg-success-500/5 text-success-500'
      : tone === 'error'
        ? 'border-error-500/30 bg-error-500/5 text-error-500'
        : 'border-warning-500/30 bg-warning-500/5 text-warning-500';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border px-4 py-3 text-left transition-colors',
        toneCls,
        active && 'ring-2 ring-offset-1 ring-current/40',
      )}
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </button>
  );
}

function ResultRow({
  result,
  expanded,
  onToggle,
}: {
  result: MetricValidation;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasError = result.issues.some((i) => i.severity === 'error');
  const hasWarning = result.issues.some((i) => i.severity === 'warning');
  const statusTone = hasError ? 'error' : hasWarning ? 'warning' : 'success';

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-neutral-50/60"
      >
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-neutral-400 shrink-0 mt-0.5" />
          ) : (
            <ChevronRight className="h-4 w-4 text-neutral-400 shrink-0 mt-0.5" />
          )}
          <StatusPill tone={statusTone} />
          <div className="min-w-0 flex-1">
            <div className="font-mono text-sm font-semibold text-neutral-900">
              {renderMetricName(result.metric)}
            </div>
            <div className="text-[11px] text-neutral-500 mt-0.5">
              {result.issues.length > 0
                ? `${result.issues.length} issue${result.issues.length !== 1 ? 's' : ''}`
                : 'No issues'}
            </div>
          </div>
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-3 pl-12 space-y-2">
          <div className="rounded-md border border-neutral-200 bg-neutral-50/50 px-3 py-2 font-mono text-xs leading-5 text-neutral-700 break-words">
            {highlightFormula(result.formula, result.issues)}
          </div>
          {result.issues.length > 0 ? (
            <ul className="space-y-1.5">
              {result.issues.map((issue, i) => (
                <li key={i} className="flex items-start gap-2">
                  <IssueIcon severity={issue.severity} />
                  <div className="flex-1">
                    <span
                      className={cn(
                        'inline-block mr-2 rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold',
                        issue.severity === 'error'
                          ? 'bg-error-500/10 text-error-500'
                          : 'bg-warning-500/10 text-warning-500',
                      )}
                    >
                      {issue.code}
                    </span>
                    <span className="text-xs text-neutral-700">{issue.message}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-success-500">All checks passed.</p>
          )}
        </div>
      )}
    </div>
  );
}

function StatusPill({ tone }: { tone: 'success' | 'warning' | 'error' }) {
  const map = {
    success: { label: 'Valid', cls: 'bg-success-500/10 text-success-500' },
    warning: { label: 'Warning', cls: 'bg-warning-500/10 text-warning-500' },
    error: { label: 'Invalid', cls: 'bg-error-500/10 text-error-500' },
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap shrink-0',
        map[tone].cls,
      )}
    >
      <span
        className={cn(
          'inline-block h-1.5 w-1.5 rounded-full',
          tone === 'success' && 'bg-success-500',
          tone === 'warning' && 'bg-warning-500',
          tone === 'error' && 'bg-error-500',
        )}
      />
      {map[tone].label}
    </span>
  );
}

function IssueIcon({ severity }: { severity: 'error' | 'warning' }) {
  if (severity === 'error') {
    return <AlertCircle className="h-3.5 w-3.5 text-error-500 shrink-0 mt-0.5" />;
  }
  return <AlertTriangle className="h-3.5 w-3.5 text-warning-500 shrink-0 mt-0.5" />;
}

/** Highlight tokens in the formula. Bad tokens get a red bg pill. */
function highlightFormula(text: string, issues: ValidationIssue[]): React.ReactNode {
  const badTokens = new Set(
    issues.filter((i) => i.severity === 'error' && i.token).map((i) => i.token as string),
  );
  const warnTokens = new Set(
    issues.filter((i) => i.severity === 'warning' && i.token).map((i) => i.token as string),
  );

  if (!text) return null;
  const parts: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const nextCurly = text.indexOf('{', i);
    const nextSquare = text.indexOf('[', i);
    let open: number;
    let isSquare: boolean;
    if (nextCurly === -1 && nextSquare === -1) {
      parts.push(<span key={key++}>{text.slice(i)}</span>);
      break;
    } else if (nextCurly === -1) {
      open = nextSquare;
      isSquare = true;
    } else if (nextSquare === -1) {
      open = nextCurly;
      isSquare = false;
    } else {
      open = Math.min(nextCurly, nextSquare);
      isSquare = open === nextSquare;
    }
    if (open > i) parts.push(<span key={key++}>{text.slice(i, open)}</span>);
    const closeChar = isSquare ? ']' : '}';
    const close = text.indexOf(closeChar, open);
    if (close === -1) {
      parts.push(<span key={key++}>{text.slice(open)}</span>);
      break;
    }
    const inner = text.slice(open + 1, close);
    const full = text.slice(open, close + 1);
    let cls = 'text-accent-700'; // neutral token
    if (isSquare) cls = 'text-success-500';
    else if (badTokens.has(inner)) cls = 'bg-error-500/15 text-error-500 rounded px-0.5';
    else if (warnTokens.has(inner)) cls = 'bg-warning-500/15 text-warning-500 rounded px-0.5';
    parts.push(
      <span key={key++} className={cls}>
        {full}
      </span>,
    );
    i = close + 1;
  }
  return parts;
}

function renderMetricName(name: string): React.ReactNode {
  const m = name.match(/^(.*?)(\s—\s(?:Shopee|TikTok))$/);
  if (!m) return name;
  return (
    <>
      {m[1]}
      <span className="text-neutral-400 font-normal">{m[2]}</span>
    </>
  );
}
