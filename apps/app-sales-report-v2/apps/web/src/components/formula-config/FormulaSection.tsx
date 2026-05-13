'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, ChevronDown, RotateCcw } from 'lucide-react';
import { cn } from '@v2/ui';
import type { FormulaSection as FormulaSectionType, FormulaItem } from '@/lib/formula-config-data';
import { DataSourceMultiSelect } from './DataSourceMultiSelect';
import { getAvailableFields, getCalculatedFields, DATA_SOURCE_FIELDS } from '@/lib/data-source-fields';
import {
  getVersionHistory,
  getVersionCount,
  getActiveFormula,
  appendVersion,
} from '@/lib/formula-version-mock';
import { VersionHistoryModal } from './VersionHistoryModal';
import { NewVersionModal } from './NewVersionModal';

interface Props {
  section: FormulaSectionType;
  values: Record<string, string>;
  sources: Record<string, string[]>;
  onChange: (metric: string, value: string) => void;
  onSourcesChange: (metric: string, next: string[]) => void;
  onSave: (metric: string) => void;
  savedKey?: string | null;
  open: boolean;
  onToggleOpen: () => void;
}

type ChannelTheme = 'shopee' | 'tiktok' | 'neutral';

function detectTheme(title: string): ChannelTheme {
  if (title.toLowerCase().includes('shopee')) return 'shopee';
  if (title.toLowerCase().includes('tiktok')) return 'tiktok';
  return 'neutral';
}

const THEME_STYLES: Record<
  ChannelTheme,
  { bar: string; headerBg: string; badgeBg: string; badgeLabel: string }
> = {
  shopee: {
    bar: 'bg-shopee',
    headerBg: 'bg-shopee/5',
    badgeBg: 'bg-shopee text-white',
    badgeLabel: 'S Shopee',
  },
  tiktok: {
    bar: 'bg-neutral-900',
    headerBg: 'bg-neutral-900/5',
    badgeBg: 'bg-neutral-900 text-white',
    badgeLabel: 'T TikTok',
  },
  neutral: {
    bar: 'bg-neutral-300',
    headerBg: 'bg-neutral-50',
    badgeBg: 'bg-neutral-200 text-neutral-700',
    badgeLabel: '',
  },
};

export function FormulaSection({
  section,
  values,
  sources,
  onChange,
  onSourcesChange,
  onSave,
  savedKey,
  open,
  onToggleOpen,
}: Props) {
  const theme = detectTheme(section.title);
  const styles = THEME_STYLES[theme];

  return (
    <section className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
      {/* Accent bar */}
      <div className={cn('h-1 w-full', styles.bar)} />

      <button
        type="button"
        onClick={onToggleOpen}
        className={cn(
          'flex w-full items-center justify-between gap-3 border-b px-5 py-3.5 text-left transition-colors hover:bg-neutral-50/60',
          open ? 'border-neutral-100' : 'border-transparent',
          styles.headerBg,
        )}
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronDown className="h-4 w-4 text-neutral-500 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-neutral-500 shrink-0" />
          )}
          {theme !== 'neutral' && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                styles.badgeBg,
              )}
            >
              {styles.badgeLabel}
            </span>
          )}
          <h2 className="text-base font-semibold text-neutral-900">{section.title}</h2>
        </div>
        <span className="text-xs text-neutral-500">{section.items.length} formulas</span>
      </button>

      {open && (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-neutral-50 text-[11px] uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-5 py-2.5 text-left font-medium w-1/4">Metric</th>
              <th className="px-3 py-2.5 text-left font-medium w-44">Data Source</th>
              <th className="px-3 py-2.5 text-left font-medium">Formula / Value</th>
              <th className="px-3 py-2.5 text-left font-medium w-16">Unit</th>
              <th className="px-3 py-2.5 text-center font-medium w-28">Edit</th>
              <th className="px-3 py-2.5 text-center font-medium w-20">History</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {section.items.map((item, i) => (
              <FormulaRow
                key={`${section.id}-${i}`}
                item={item}
                value={values[item.metric] ?? item.formula}
                currentSources={sources[item.metric] ?? item.dataSources}
                onChange={(v) => onChange(item.metric, v)}
                onSourcesChange={(next) => onSourcesChange(item.metric, next)}
                onSave={() => onSave(item.metric)}
                justSaved={savedKey === item.metric}
              />
            ))}
          </tbody>
        </table>
      </div>
      )}
    </section>
  );
}

function FormulaRow({
  item,
  value,
  currentSources,
  onChange,
  onSourcesChange,
  onSave,
  justSaved,
}: {
  item: FormulaItem;
  value: string;
  currentSources: string[];
  onChange: (v: string) => void;
  onSourcesChange: (next: string[]) => void;
  onSave: () => void;
  justSaved?: boolean;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [newVersionOpen, setNewVersionOpen] = useState(false);
  // Local state — initialized from storage, bumped on each new version
  const [versionCount, setVersionCount] = useState<number | null>(null);
  const [activeFormula, setActiveFormula] = useState<string>(item.formula);
  useEffect(() => {
    const refresh = () => {
      setVersionCount(getVersionCount(item.metric));
      setActiveFormula(getActiveFormula(item.metric, item.formula));
    };
    refresh();

    // Cross-tab sync — when another tab appends a version, update this row's count + active
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'formula-config-history') refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [item.metric, item.formula]);
  const displayCount = versionCount ?? item.versions;

  const hasChanged = value !== activeFormula;
  const handleSaveClick = () => {
    if (hasChanged) {
      setNewVersionOpen(true);
    } else {
      onSave();
    }
  };
  return (
    <tr className="hover:bg-neutral-50/40">
      <td className="px-5 py-3 align-top">
        <div className="text-sm font-semibold text-neutral-900">{renderMetricName(item.metric)}</div>
      </td>
      <td className="px-3 py-3 align-top">
        <DataSourceMultiSelect value={currentSources} onChange={onSourcesChange} />
      </td>
      <td className="px-3 py-3 align-top">
        <FormulaInput value={value} onChange={onChange} sources={currentSources} />
      </td>
      <td className="px-3 py-3 align-top text-sm text-neutral-500">{item.unit ?? '—'}</td>
      <td className="px-3 py-3 align-top text-center">
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={handleSaveClick}
            className={cn(
              'inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium text-white transition-colors',
              justSaved ? 'bg-success-500' : 'bg-info-500 hover:bg-info-500/90',
            )}
          >
            {justSaved ? 'Saved' : 'Save'}
          </button>
          {value !== item.formula && (
            <button
              type="button"
              onClick={() => {
                onChange(item.formula);
                onSourcesChange(item.dataSources);
              }}
              title="Reset to default (catalog seed)"
              aria-label="Reset to default"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-neutral-300 bg-white text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {newVersionOpen && (
          <NewVersionModal
            metric={item.metric}
            oldFormula={activeFormula}
            newFormula={value}
            onCancel={() => setNewVersionOpen(false)}
            onConfirm={({ reason, effectiveDate, retroactive }) => {
              appendVersion(item.metric, {
                newFormula: value,
                reason,
                effectiveDate,
                retroactive,
              });
              setVersionCount(getVersionCount(item.metric));
              setActiveFormula(getActiveFormula(item.metric, item.formula));
              setNewVersionOpen(false);
              onSave();
            }}
          />
        )}
      </td>
      <td className="px-3 py-3 align-top text-center">
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className="inline-flex items-center gap-0.5 rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-xs font-mono font-semibold text-neutral-700 hover:bg-neutral-50"
          aria-label={`View version history for ${item.metric}`}
        >
          {displayCount}
          <ChevronRight className="h-3 w-3 text-neutral-400" />
        </button>
        {historyOpen && (
          <VersionHistoryModal
            metric={item.metric}
            currentFormula={value}
            dataSources={currentSources}
            unit={item.unit}
            history={getVersionHistory(item.metric)}
            onClose={() => setHistoryOpen(false)}
          />
        )}
      </td>
    </tr>
  );
}

/**
 * Formula input that highlights {token} references in orange and offers
 * autocomplete from the selected data sources when the caret is inside an
 * unclosed `{...`.
 */
function FormulaInput({
  value,
  onChange,
  sources,
}: {
  value: string;
  onChange: (v: string) => void;
  sources: string[];
}) {
  const [focused, setFocused] = useState(false);
  const [caret, setCaret] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Auto-grow textarea height to fit content (capped). Called on focus + change.
  const adjustHeight = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 280)}px`;
  };
  // Collapse back to single-row baseline on blur.
  const resetHeight = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = '';
  };

  const groups = useMemo(() => getAvailableFields(sources), [sources]);

  // Split into raw-CSV fields vs calculated-metric fields for tri-color highlighting
  const { rawSet, calcSet } = useMemo(() => {
    const raw = new Set<string>();
    const calc = new Set<string>();
    for (const src of sources) {
      if (src === 'Calculated') {
        for (const f of getCalculatedFields()) calc.add(f);
      } else {
        const fields = DATA_SOURCE_FIELDS[src];
        if (fields) for (const f of fields) raw.add(f);
      }
    }
    return { rawSet: raw, calcSet: calc };
  }, [sources]);

  // Detect open `{...` before caret (no `}` between it and caret)
  const trigger = useMemo(() => {
    if (!focused) return null;
    const left = value.slice(0, caret);
    const openIdx = left.lastIndexOf('{');
    if (openIdx === -1) return null;
    const closeAfterOpen = left.indexOf('}', openIdx);
    if (closeAfterOpen !== -1) return null;
    return { start: openIdx, query: left.slice(openIdx + 1) };
  }, [focused, value, caret]);

  // Flatten matches against query for keyboard nav
  const filteredGroups = useMemo(() => {
    if (!trigger) return [];
    const q = trigger.query.trim().toLowerCase();
    return groups
      .map((g) => ({
        source: g.source,
        fields: q === '' ? g.fields : g.fields.filter((f) => f.toLowerCase().includes(q)),
      }))
      .filter((g) => g.fields.length > 0);
  }, [groups, trigger]);

  const flatList = useMemo(
    () => filteredGroups.flatMap((g) => g.fields.map((f) => ({ source: g.source, field: f }))),
    [filteredGroups],
  );

  // Clamp active index when list changes
  useEffect(() => {
    if (activeIdx >= flatList.length) setActiveIdx(0);
  }, [flatList.length, activeIdx]);

  const open = trigger !== null && flatList.length > 0;

  const updateCaret = () => {
    const el = inputRef.current;
    if (!el) return;
    setCaret(el.selectionStart ?? el.value.length);
  };

  const insertField = (field: string) => {
    if (!trigger) return;
    const before = value.slice(0, trigger.start);
    const after = value.slice(caret);
    const insertion = `{${field}}`;
    const next = before + insertion + after;
    onChange(next);
    // Move caret to end of inserted token (after `}`)
    const nextCaret = before.length + insertion.length;
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(nextCaret, nextCaret);
      setCaret(nextCaret);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % flatList.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + flatList.length) % flatList.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const pick = flatList[activeIdx];
      if (pick) insertField(pick.field);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      inputRef.current?.blur();
    }
  };

  // Prevent Enter from inserting a newline when autocomplete is closed
  // (formulas stay single-string; wrapping is handled by CSS).
  const onKeyDownCapture = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={inputRef}
        rows={1}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          // Schedule caret read + height adjust after value applies
          requestAnimationFrame(() => {
            updateCaret();
            adjustHeight();
          });
        }}
        onFocus={() => {
          setFocused(true);
          updateCaret();
          requestAnimationFrame(adjustHeight);
        }}
        onBlur={(e) => {
          // If blur target is inside popover (mousedown on item), keep focus
          if (popoverRef.current && popoverRef.current.contains(e.relatedTarget as Node)) return;
          setFocused(false);
          resetHeight();
        }}
        onKeyDownCapture={onKeyDownCapture}
        onKeyDown={onKeyDown}
        onKeyUp={updateCaret}
        onClick={updateCaret}
        onSelect={updateCaret}
        spellCheck={false}
        className={cn(
          'block w-full resize-none rounded-md border bg-white px-3 py-1.5 font-mono text-sm leading-6 whitespace-pre-wrap break-words transition-colors focus:outline-none',
          focused ? 'border-info-500 text-neutral-900' : 'border-neutral-300 text-transparent caret-neutral-900 overflow-hidden',
        )}
      />
      {!focused && (
        <div className="pointer-events-none absolute inset-0 flex items-center px-3 font-mono text-sm whitespace-nowrap overflow-hidden">
          <span className="truncate">{highlightTokens(value, rawSet, calcSet)}</span>
        </div>
      )}
      {focused && /\[[^\]]+\]/.test(value) && (
        <div className="mt-1 text-[11px] text-neutral-500">
          <span className="text-success-500">●</span> Values in{' '}
          <code className="font-mono">[brackets]</code> are editable parameters / literals — change
          to tune the formula.
        </div>
      )}

      {open && (
        <div
          ref={popoverRef}
          // Prevent input blur when clicking inside popover
          onMouseDown={(e) => e.preventDefault()}
          className="absolute left-0 top-full z-40 mt-1 w-[22rem] max-h-72 overflow-y-auto rounded-md border border-neutral-200 bg-white shadow-lg"
        >
          {sources.length === 0 ? (
            <div className="px-3 py-3 text-xs text-neutral-500">
              Select a data source to see available fields.
            </div>
          ) : (
            (() => {
              let cursor = 0;
              return filteredGroups.map((g) => (
                <div key={g.source}>
                  <div className="sticky top-0 z-10 bg-neutral-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 border-b border-neutral-100">
                    {g.source}
                  </div>
                  <ul className="py-1">
                    {g.fields.map((f) => {
                      const idx = cursor++;
                      const active = idx === activeIdx;
                      return (
                        <li key={f}>
                          <button
                            type="button"
                            onClick={() => insertField(f)}
                            onMouseEnter={() => setActiveIdx(idx)}
                            className={cn(
                              'flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-xs',
                              active ? 'bg-info-50 text-info-500' : 'text-neutral-700 hover:bg-neutral-50',
                            )}
                          >
                            <span className="truncate">{f}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ));
            })()
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Render metric name with the trailing `— Shopee` / `— TikTok` suffix dimmed.
 * The section header already says which platform, so the suffix is redundant
 * visually but kept in the data so the engine can resolve names globally.
 */
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

/**
 * Color-code each `{token}` and `[literal]`:
 *   - blue  : `{calculated metric}` (defined in FORMULA_SECTIONS)
 *   - orange: `{raw CSV column}` from one of the selected non-Calculated sources
 *   - red   : `{unresolved}` — typo or missing source
 *   - green : `[literal value]` or `[N parameter]` — editable by user
 * Calculated wins on overlap (intentional override semantic).
 */
function highlightTokens(
  text: string,
  rawSet: Set<string>,
  calcSet: Set<string>,
): React.ReactNode {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    // Find the next `{` or `[` — whichever comes first
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
    if (open > i) {
      parts.push(<span key={key++}>{text.slice(i, open)}</span>);
    }
    const closeChar = isSquare ? ']' : '}';
    const close = text.indexOf(closeChar, open);
    if (close === -1) {
      parts.push(<span key={key++}>{text.slice(open)}</span>);
      break;
    }
    const inner = text.slice(open + 1, close);
    let cls: string;
    let title: string;
    if (isSquare) {
      cls = 'text-success-500';
      title = /^-?\d+(\.\d+)?$/.test(inner)
        ? `Editable parameter: ${inner}. Change to any number.`
        : `Literal value: "${inner}". Edit if the underlying category/status is renamed.`;
    } else {
      cls = 'text-error-500';
      title = `Unknown field: "${inner}". Add a matching data source.`;
      if (calcSet.has(inner)) {
        cls = 'text-info-500';
        title = `Calculated metric: ${inner}`;
      } else if (rawSet.has(inner)) {
        cls = 'text-accent-700';
        title = `Raw column: ${inner}`;
      }
    }
    parts.push(
      <span key={key++} className={cls} title={title}>
        {text.slice(open, close + 1)}
      </span>,
    );
    i = close + 1;
  }
  return parts;
}
