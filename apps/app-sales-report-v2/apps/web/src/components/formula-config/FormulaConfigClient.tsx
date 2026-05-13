'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, X, Download } from 'lucide-react';
import { cn } from '@v2/ui';
import { FORMULA_SECTIONS } from '@/lib/formula-config-data';
import { FormulaSection } from './FormulaSection';
import { exportFormulaConfig } from '@/lib/formula-export';

const VALUES_KEY = 'formula-config-values';
const SOURCES_KEY = 'formula-config-sources';

const ALL_DATA_SOURCES = [
  'Shopee Sales CSV',
  'Shopee Traffic CSV',
  'Shopee Ads CSV',
  'Shopee Brand Ads CSV',
  'Shopee Off-Platform Ads CSV',
  'Shopee Affiliate CSV',
  'TikTok Sales CSV',
  'TikTok Traffic CSV',
  'TikTok Affiliate CSV',
  'Prime Cost Table',
  'Manual Input',
  'Calculated',
];

interface FormulaConfigClientProps {
  /** Replace the default Settings page header (h1/h2 block). */
  header?: React.ReactNode;
  /** Show the search + section/source filter bar. Default true. */
  showFilters?: boolean;
  /** Show the Export button. Default true. */
  showExport?: boolean;
}

export function FormulaConfigClient({
  header,
  showFilters = true,
  showExport = true,
}: FormulaConfigClientProps = {}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [sources, setSources] = useState<Record<string, string[]>>({});
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    FORMULA_SECTIONS.reduce((acc, s) => ({ ...acc, [s.id]: true }), {} as Record<string, boolean>),
  );

  // Filter state
  const [query, setQuery] = useState('');
  const [sectionFilters, setSectionFilters] = useState<string[]>([]);
  const [sourceFilters, setSourceFilters] = useState<string[]>([]);
  const [exportOpen, setExportOpen] = useState(false);

  const allOpen = FORMULA_SECTIONS.every((s) => openSections[s.id]);
  const setAllOpen = (v: boolean) =>
    setOpenSections(
      FORMULA_SECTIONS.reduce((acc, s) => ({ ...acc, [s.id]: v }), {} as Record<string, boolean>),
    );

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    const readValues = () => {
      try {
        const rawV = localStorage.getItem(VALUES_KEY);
        if (rawV) {
          const parsed = JSON.parse(rawV);
          if (parsed && typeof parsed === 'object') setValues(parsed);
        }
      } catch {
        // ignore
      }
    };
    const readSources = () => {
      try {
        const rawS = localStorage.getItem(SOURCES_KEY);
        if (rawS) {
          const parsed = JSON.parse(rawS);
          if (parsed && typeof parsed === 'object') setSources(parsed);
        }
      } catch {
        // ignore
      }
    };

    readValues();
    readSources();

    // Cross-tab sync — `storage` event fires when OTHER tabs mutate localStorage
    const onStorage = (e: StorageEvent) => {
      if (e.key === VALUES_KEY) readValues();
      if (e.key === SOURCES_KEY) readSources();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setValue = (metric: string, value: string) => {
    setValues((prev) => {
      const next = { ...prev, [metric]: value };
      try {
        localStorage.setItem(VALUES_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const setSourcesFor = (metric: string, nextSources: string[]) => {
    setSources((prev) => {
      const next = { ...prev, [metric]: nextSources };
      try {
        localStorage.setItem(SOURCES_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const onSave = (metric: string) => {
    setSavedKey(metric);
    setTimeout(() => setSavedKey((k) => (k === metric ? null : k)), 1200);
  };

  // Filtering
  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FORMULA_SECTIONS.filter((s) =>
      sectionFilters.length === 0 ? true : sectionFilters.includes(s.id),
    )
      .map((s) => ({
        ...s,
        items: s.items.filter((item) => {
          const matchName = q === '' || item.metric.toLowerCase().includes(q);
          const itemSources = sources[item.metric] ?? item.dataSources;
          const matchSource =
            sourceFilters.length === 0 || sourceFilters.some((src) => itemSources.includes(src));
          return matchName && matchSource;
        }),
      }))
      .filter((s) => s.items.length > 0);
  }, [query, sectionFilters, sourceFilters, sources]);

  const hasActiveFilter =
    query.length > 0 || sectionFilters.length > 0 || sourceFilters.length > 0;

  const totalMetrics = FORMULA_SECTIONS.reduce((sum, s) => sum + s.items.length, 0);
  const visibleMetrics = filteredSections.reduce((sum, s) => sum + s.items.length, 0);

  // Right-side toolbar: legend, optional Export, Expand/Collapse
  const toolbar = (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-3 text-[11px] text-neutral-500">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-accent-700" />
          <span>raw column</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-info-500" />
          <span>calculated</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-error-500" />
          <span>unknown</span>
        </span>
        <span
          className="inline-flex items-center gap-1"
          title="Editable parameter / literal value"
        >
          <span className="inline-block h-2 w-2 rounded-full bg-success-500" />
          <span>[editable]</span>
        </span>
      </div>
      {showExport && (
        <ExportMenu open={exportOpen} setOpen={setExportOpen} values={values} sources={sources} />
      )}
      <button
        type="button"
        onClick={() => setAllOpen(!allOpen)}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
      >
        {allOpen ? 'Collapse all' : 'Expand all'}
      </button>
    </div>
  );

  return (
    <div className="space-y-5">
      {header !== undefined ? (
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">{header}</div>
          {toolbar}
        </div>
      ) : (
        <>
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Settings</h1>
            <p className="mt-1 text-sm text-neutral-500">
              User management and formula configuration — Admin only
            </p>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-neutral-900">Formula Configuration</h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                Changes are auto-saved to your browser
              </p>
            </div>
            {toolbar}
          </div>
        </>
      )}

      {showFilters && (
        <div className="rounded-lg border border-neutral-200 bg-white p-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search metric by name…"
              className="w-full rounded-md border border-neutral-300 bg-white py-1.5 pl-8 pr-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:border-info-500"
            />
          </div>
          <FilterChipDropdown
            label="Section"
            options={FORMULA_SECTIONS.map((s) => ({ id: s.id, label: s.title }))}
            selected={sectionFilters}
            onChange={setSectionFilters}
          />
          <FilterChipDropdown
            label="Data Source"
            options={ALL_DATA_SOURCES.map((s) => ({ id: s, label: s }))}
            selected={sourceFilters}
            onChange={setSourceFilters}
          />
          <span className="text-xs text-neutral-500 ml-auto">
            Showing <span className="font-semibold text-neutral-900">{visibleMetrics}</span> /{' '}
            {totalMetrics}
          </span>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSectionFilters([]);
                setSourceFilters([]);
              }}
              className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              <X className="h-3 w-3" />
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Sections */}
      <div className="space-y-5">
        {filteredSections.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-10 text-center text-sm text-neutral-500">
            No metrics match the current filters.
          </div>
        ) : (
          filteredSections.map((section) => (
            <FormulaSection
              key={section.id}
              section={section}
              values={values}
              sources={sources}
              onChange={setValue}
              onSourcesChange={setSourcesFor}
              onSave={onSave}
              savedKey={savedKey}
              open={openSections[section.id] ?? true}
              onToggleOpen={() => toggleSection(section.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

/** Multi-select chip dropdown for filter bar. */
function FilterChipDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
          selected.length > 0
            ? 'border-info-500 bg-info-50 text-info-500'
            : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50',
        )}
      >
        {label}
        {selected.length > 0 && (
          <span className="inline-flex items-center justify-center rounded-full bg-info-500 text-white px-1.5 text-[10px] font-semibold">
            {selected.length}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-40 mt-1 w-64 rounded-md border border-neutral-200 bg-white shadow-lg p-1 max-h-80 overflow-y-auto">
            {options.map((opt) => {
              const checked = selected.includes(opt.id);
              return (
                <label
                  key={opt.id}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-neutral-50 rounded"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      onChange(
                        checked ? selected.filter((s) => s !== opt.id) : [...selected, opt.id],
                      )
                    }
                    className="accent-info-500"
                  />
                  <span className="truncate">{opt.label}</span>
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/** Export dropdown — JSON or CSV. */
function ExportMenu({
  open,
  setOpen,
  values,
  sources,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  values: Record<string, string>;
  sources: Record<string, string[]>;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
      >
        <Download className="h-3.5 w-3.5" />
        Export
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-40 mt-1 w-40 rounded-md border border-neutral-200 bg-white shadow-lg p-1">
            <button
              type="button"
              onClick={() => {
                exportFormulaConfig('json', values, sources);
                setOpen(false);
              }}
              className="block w-full text-left rounded px-2.5 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
            >
              Export as JSON
            </button>
            <button
              type="button"
              onClick={() => {
                exportFormulaConfig('csv', values, sources);
                setOpen(false);
              }}
              className="block w-full text-left rounded px-2.5 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
            >
              Export as CSV
            </button>
          </div>
        </>
      )}
    </div>
  );
}
