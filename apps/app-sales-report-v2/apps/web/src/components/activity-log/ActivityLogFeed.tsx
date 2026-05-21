'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  SlidersHorizontal,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CalendarRange,
  X,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@v2/ui';
import {
  listActionLogsAction,
  exportActionLogsAction,
  type ActionLogRow,
} from '@/server/actions/action-log.actions';
import { getMockActionLogs, subscribeMockLog } from '@/lib/action-log-mock';
import { downloadCsv } from '@/lib/csv';

const CATEGORIES = ['UPLOAD', 'APPROVAL', 'MANUAL_INPUT', 'MASTER_DATA', 'FORMULA', 'REPORT', 'EXPORT', 'OTHER'] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_DOT: Record<Category, string> = {
  UPLOAD: 'bg-info-500',
  APPROVAL: 'bg-success-500',
  MANUAL_INPUT: 'bg-neutral-700',
  MASTER_DATA: 'bg-accent-500',
  FORMULA: 'bg-warning-500',
  REPORT: 'bg-info-500',
  EXPORT: 'bg-neutral-500',
  OTHER: 'bg-neutral-400',
};

const CATEGORY_PILL: Record<Category, string> = {
  UPLOAD: 'bg-info-50 text-info-500',
  APPROVAL: 'bg-success-500/10 text-success-500',
  MANUAL_INPUT: 'bg-neutral-100 text-neutral-700',
  MASTER_DATA: 'bg-accent-50 text-accent-700',
  FORMULA: 'bg-warning-500/10 text-warning-500',
  REPORT: 'bg-info-50 text-info-500',
  EXPORT: 'bg-neutral-100 text-neutral-700',
  OTHER: 'bg-neutral-100 text-neutral-500',
};

function CategoryPill({
  category,
  label,
}: {
  category: Category;
  label: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
        CATEGORY_PILL[category],
      )}
    >
      <span className={cn('inline-block h-1.5 w-1.5 rounded-full', CATEGORY_DOT[category])} />
      {label}
    </span>
  );
}

function splitDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '—', time: '' };
  const pad = (n: number) => n.toString().padStart(2, '0');
  return {
    date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
  };
}

/** Returns "YYYY-MM-DD" in local time for grouping. */
function localDayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** YYYY-MM-DD for today (local). */
function todayKey(): string {
  return localDayKey(new Date().toISOString());
}

/** YYYY-MM-DD offset N days from today (local). N can be negative. */
function offsetDayKey(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDayKey(d.toISOString());
}

/** First day of the current month (local), YYYY-MM-DD. */
function startOfMonthKey(): string {
  const d = new Date();
  d.setDate(1);
  return localDayKey(d.toISOString());
}

/** Convert YYYY-MM-DD to ISO at local start-of-day. Empty input → undefined. */
function toIsoStartOfDay(dayKey: string | null): string | undefined {
  if (!dayKey) return undefined;
  const d = new Date(`${dayKey}T00:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

/** Convert YYYY-MM-DD to ISO at local end-of-day (23:59:59.999). Empty input → undefined. */
function toIsoEndOfDay(dayKey: string | null): string | undefined {
  if (!dayKey) return undefined;
  const d = new Date(`${dayKey}T23:59:59.999`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

/** True when the row's local day is within [from, to] inclusive (either bound may be null). */
function isWithinDateRange(iso: string, from: string | null, to: string | null): boolean {
  if (!from && !to) return true;
  const key = localDayKey(iso);
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
}

interface ActivityLogFeedProps {
  initialRows: ActionLogRow[];
  initialHasMore: boolean;
  initialTotal: number;
  initialNextCursor: string | null;
}

export function ActivityLogFeed({
  initialRows,
  initialHasMore,
  initialTotal,
  initialNextCursor,
}: ActivityLogFeedProps) {
  const t = useTranslations('activityLog');
  const tCommon = useTranslations('common');
  const tRole = useTranslations('role');
  const locale = useLocale();
  const intlLocale = locale === 'ko' ? 'ko-KR' : 'en-US';

  const roleLabel = (role: string): string => {
    switch (role) {
      case 'ADMIN':
        return tRole('admin');
      case 'MANAGER':
        return tRole('manager');
      case 'OPERATOR':
        return tRole('operator');
      default:
        return role;
    }
  };

  // Any value that can differ between server and the user's browser (clock,
  // localStorage mock rows) must be deferred until after mount so the first
  // client render exactly matches the SSR output — otherwise React throws
  // a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const formatDayHeader = (dayKey: string): string => {
    const d = new Date(dayKey + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return dayKey;
    const dayDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const human = dayDate.toLocaleDateString(intlLocale, {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    if (!mounted) return human;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 86_400_000);
    if (dayDate.getTime() === today.getTime()) return t('dayHeader.today', { date: human });
    if (dayDate.getTime() === yesterday.getTime()) return t('dayHeader.yesterday', { date: human });
    return human;
  };

  const [rows, setRows] = useState<ActionLogRow[]>(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [search, setSearch] = useState('');
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(new Set());
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const categoriesArray = useMemo(() => Array.from(activeCategories), [activeCategories]);

  // Mock entries from localStorage — written by formula save, raw-archive approve/reject, etc.
  // Until `sal_action_logs` ships server-side, this is the source of truth for demo actions.
  const [mockTick, setMockTick] = useState(0);
  useEffect(() => subscribeMockLog(() => setMockTick((t) => t + 1)), []);
  const mockRows = useMemo<ActionLogRow[]>(() => {
    // Skip on SSR + first client render — localStorage is browser-only and
    // would otherwise cause a hydration mismatch (server sees no mock rows,
    // client immediately has them on first render).
    if (!mounted) return [];
    const all = getMockActionLogs();
    const q = search.trim().toLowerCase();
    return all.filter((r) => {
      if (activeCategories.size > 0 && !activeCategories.has(r.category as Category)) return false;
      if (!isWithinDateRange(r.createdAt, dateFrom, dateTo)) return false;
      if (!q) return true;
      const hay =
        `${r.username} ${r.verb} ${r.targetLabel} ${r.summary ?? ''} ${r.category}`.toLowerCase();
      return hay.includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, mockTick, search, activeCategories, dateFrom, dateTo]);

  // Merge server rows + mock rows, dedupe by actId, sort newest first
  const displayRows = useMemo<ActionLogRow[]>(() => {
    const map = new Map<string, ActionLogRow>();
    for (const r of mockRows) map.set(r.actId, r);
    for (const r of rows) map.set(r.actId, r);
    return Array.from(map.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [mockRows, rows]);

  const displayTotal = total + mockRows.length;

  // Pagination
  const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(25);
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(displayRows.length / pageSize));
  // Reset to page 1 when filters or list size changes
  useEffect(() => {
    setPage(1);
  }, [search, activeCategories, dateFrom, dateTo, pageSize, displayRows.length === 0]);
  // Clamp current page if it exceeds new page count
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [pageCount, page]);

  const pageStartIdx = (page - 1) * pageSize;
  const pagedRows = useMemo(
    () => displayRows.slice(pageStartIdx, pageStartIdx + pageSize),
    [displayRows, pageStartIdx, pageSize],
  );

  // Group paged rows by local day, newest day first
  const grouped = useMemo(() => {
    const map = new Map<string, ActionLogRow[]>();
    for (const row of pagedRows) {
      const key = localDayKey(row.createdAt);
      const bucket = map.get(key);
      if (bucket) bucket.push(row);
      else map.set(key, [row]);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [pagedRows]);

  const rangeStart = displayRows.length === 0 ? 0 : pageStartIdx + 1;
  const rangeEnd = Math.min(pageStartIdx + pageSize, displayRows.length);

  const refresh = useCallback(
    async (q: string, cats: Category[], from: string | null, to: string | null) => {
      setLoading(true);
      const res = await listActionLogsAction({
        search: q || undefined,
        categories: cats.length > 0 ? cats : undefined,
        dateFrom: toIsoStartOfDay(from),
        dateTo: toIsoEndOfDay(to),
        limit: 10,
      });
      setLoading(false);
      if (!res.success) {
        setFeedback(res.error.message);
        return;
      }
      setRows(res.data.rows);
      setHasMore(res.data.hasMore);
      setTotal(res.data.total);
      setNextCursor(res.data.nextCursor);
    },
    [],
  );

  // Skip the very first run (we have initial server data) — only react on input changes after mount
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void refresh(search, categoriesArray, dateFrom, dateTo);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, categoriesArray, dateFrom, dateTo, refresh]);

  const loadMore = async () => {
    if (!hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    const res = await listActionLogsAction({
      search: search || undefined,
      categories: categoriesArray.length > 0 ? categoriesArray : undefined,
      dateFrom: toIsoStartOfDay(dateFrom),
      dateTo: toIsoEndOfDay(dateTo),
      cursor: nextCursor,
      limit: 10,
    });
    setLoadingMore(false);
    if (!res.success) {
      setFeedback(res.error.message);
      return;
    }
    setRows((prev) => [...prev, ...res.data.rows]);
    setHasMore(res.data.hasMore);
    setNextCursor(res.data.nextCursor);
  };

  const onExport = async () => {
    setExporting(true);
    const res = await exportActionLogsAction({
      search: search || undefined,
      categories: categoriesArray.length > 0 ? categoriesArray : undefined,
      dateFrom: toIsoStartOfDay(dateFrom),
      dateTo: toIsoEndOfDay(dateTo),
    });
    setExporting(false);
    if (!res.success) {
      setFeedback(res.error.message);
      return;
    }
    downloadCsv(res.data.csv, res.data.filename);
  };

  const toggleCategory = (c: Category) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  const fmtDayShort = (dayKey: string): string => {
    const d = new Date(`${dayKey}T00:00:00`);
    if (Number.isNaN(d.getTime())) return dayKey;
    return d.toLocaleDateString(intlLocale, { day: '2-digit', month: 'short' });
  };

  const dateActive = !!(dateFrom || dateTo);
  const dateButtonLabel = (() => {
    if (dateFrom && dateTo) {
      return dateFrom === dateTo
        ? fmtDayShort(dateFrom)
        : `${fmtDayShort(dateFrom)} – ${fmtDayShort(dateTo)}`;
    }
    if (dateFrom) return t('dateFilter.fromShort', { date: fmtDayShort(dateFrom) });
    if (dateTo) return t('dateFilter.toShort', { date: fmtDayShort(dateTo) });
    return t('dateFilter.label');
  })();

  const applyPreset = (preset: 'today' | 'last7' | 'last30' | 'thisMonth') => {
    const today = todayKey();
    if (preset === 'today') {
      setDateFrom(today);
      setDateTo(today);
    } else if (preset === 'last7') {
      setDateFrom(offsetDayKey(-6));
      setDateTo(today);
    } else if (preset === 'last30') {
      setDateFrom(offsetDayKey(-29));
      setDateTo(today);
    } else {
      setDateFrom(startOfMonthKey());
      setDateTo(today);
    }
  };

  const clearDate = () => {
    setDateFrom(null);
    setDateTo(null);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full rounded-md border border-neutral-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none"
          />
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setDateOpen((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border bg-white px-3 py-2 text-sm font-medium',
              dateActive
                ? 'border-accent-700 text-accent-700'
                : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50',
            )}
          >
            <CalendarRange className="h-4 w-4" />
            <span className="whitespace-nowrap">{dateButtonLabel}</span>
            {dateActive && (
              <span
                role="button"
                tabIndex={0}
                aria-label={t('dateFilter.clear')}
                onClick={(e) => {
                  e.stopPropagation();
                  clearDate();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    clearDate();
                  }
                }}
                className="ml-0.5 rounded p-0.5 hover:bg-accent-700/10"
              >
                <X className="h-3 w-3" />
              </span>
            )}
          </button>
          {dateOpen && (
            <div className="absolute right-0 z-20 mt-1 w-72 rounded-md border border-neutral-200 bg-white p-3 shadow-md space-y-3">
              <div>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  {t('dateFilter.presets')}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <PresetChip label={t('dateFilter.preset.today')} onClick={() => applyPreset('today')} />
                  <PresetChip label={t('dateFilter.preset.last7')} onClick={() => applyPreset('last7')} />
                  <PresetChip label={t('dateFilter.preset.last30')} onClick={() => applyPreset('last30')} />
                  <PresetChip label={t('dateFilter.preset.thisMonth')} onClick={() => applyPreset('thisMonth')} />
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  {t('dateFilter.custom')}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-[11px] text-neutral-500">
                    <span className="mb-0.5 block">{t('dateFilter.from')}</span>
                    <input
                      type="date"
                      value={dateFrom ?? ''}
                      max={dateTo ?? undefined}
                      onChange={(e) => setDateFrom(e.target.value || null)}
                      className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-900 focus:outline-none focus:border-info-500"
                    />
                  </label>
                  <label className="block text-[11px] text-neutral-500">
                    <span className="mb-0.5 block">{t('dateFilter.to')}</span>
                    <input
                      type="date"
                      value={dateTo ?? ''}
                      min={dateFrom ?? undefined}
                      max={todayKey()}
                      onChange={(e) => setDateTo(e.target.value || null)}
                      className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-900 focus:outline-none focus:border-info-500"
                    />
                  </label>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={clearDate}
                  disabled={!dateActive}
                  className="rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  {t('dateFilter.clear')}
                </button>
                <button
                  type="button"
                  onClick={() => setDateOpen(false)}
                  className="rounded-md bg-neutral-900 px-3 py-1 text-xs font-semibold text-white hover:bg-neutral-800"
                >
                  {t('dateFilter.done')}
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border bg-white px-3 py-2 text-sm font-medium',
              activeCategories.size > 0 ? 'border-accent-700 text-accent-700' : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50',
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {t('filter')}
            {activeCategories.size > 0 && (
              <span className="ml-1 rounded-full bg-accent-700 px-1.5 py-0.5 text-[10px] font-mono text-white">
                {activeCategories.size}
              </span>
            )}
          </button>
          {filterOpen && (
            <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-neutral-200 bg-white p-2 shadow-md">
              <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                {t('filterCategories')}
              </div>
              <ul className="space-y-0.5">
                {CATEGORIES.map((c) => (
                  <li key={c}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-neutral-100">
                      <input
                        type="checkbox"
                        checked={activeCategories.has(c)}
                        onChange={() => toggleCategory(c)}
                      />
                      <span className={cn('h-2 w-2 rounded-full', CATEGORY_DOT[c])} />
                      <span className="text-neutral-700">{t(`category.${c}`)}</span>
                    </label>
                  </li>
                ))}
              </ul>
              {activeCategories.size > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveCategories(new Set())}
                  className="mt-1 w-full rounded px-2 py-1 text-left text-xs text-neutral-500 hover:bg-neutral-100"
                >
                  {t('clearAll')}
                </button>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onExport}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {exporting ? t('exporting') : t('export')}
        </button>
      </div>

      {feedback && (
        <div className="rounded-md border border-error-500 bg-error-50 px-3 py-2 text-sm text-error-500">
          {feedback}
        </div>
      )}

      {/* Feed — grouped by day */}
      {loading && displayRows.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white px-6 py-8 text-center text-sm text-neutral-500">
          {tCommon('loading')}
        </div>
      ) : displayRows.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white px-6 py-10 text-center text-sm text-neutral-500">
          {t('empty')}
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(([dayKey, dayRows]) => (
            <div
              key={dayKey}
              className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
            >
              {/* Day header */}
              <div className="flex items-center justify-between gap-3 bg-neutral-50/80 px-4 py-2 border-b border-neutral-100">
                <h3 className="text-xs font-semibold text-neutral-900">
                  {formatDayHeader(dayKey)}
                </h3>
                <span className="text-[11px] text-neutral-500 tabular-nums">
                  {t('dayActionCount', { count: dayRows.length })}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                  <thead className="bg-white text-[10px] uppercase tracking-wider text-neutral-500 border-b border-neutral-100">
                    <tr>
                      <th
                        style={{ width: '80px' }}
                        className="px-4 py-2 text-left font-semibold"
                      >
                        {t('column.time')}
                      </th>
                      <th
                        style={{ width: '128px' }}
                        className="px-3 py-2 text-left font-semibold"
                      >
                        {t('column.category')}
                      </th>
                      <th
                        style={{ width: '200px' }}
                        className="px-3 py-2 text-left font-semibold"
                      >
                        {t('column.user')}
                      </th>
                      <th
                        style={{ width: '110px' }}
                        className="px-3 py-2 text-left font-semibold"
                      >
                        {t('column.action')}
                      </th>
                      <th
                        style={{ width: '220px' }}
                        className="px-3 py-2 text-left font-semibold"
                      >
                        {t('column.target')}
                      </th>
                      <th className="px-3 py-2 text-left font-semibold">{t('column.details')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {dayRows.map((row) => {
                      const dt = splitDateTime(row.createdAt);
                      const cat = row.category as Category;
                      return (
                        <tr key={row.actId} className="hover:bg-neutral-50/60 align-top">
                          <td className="px-4 py-3 font-mono text-xs text-neutral-500 tabular-nums whitespace-nowrap">
                            {dt.time}
                          </td>
                          <td className="px-3 py-3">
                            <CategoryPill category={cat} label={t(`category.${cat}`)} />
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-mono text-xs text-info-500 truncate">
                              {row.username}
                            </div>
                            <div className="text-[11px] text-neutral-500">
                              {roleLabel(row.userRole)}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-neutral-700 whitespace-nowrap">
                              {row.verb}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="text-xs font-semibold text-neutral-900 break-words">
                              {row.targetLabel}
                            </div>
                            {row.targetType && (
                              <div className="text-[10px] uppercase tracking-wider text-neutral-400">
                                {row.targetType}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {row.summary ? (
                              <span className="text-xs text-neutral-600 break-words">
                                {row.summary}
                              </span>
                            ) : (
                              <span className="text-xs text-neutral-300">{tCommon('dash')}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Pagination footer */}
          <div className="rounded-lg border border-neutral-200 bg-neutral-50/40 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 text-neutral-500">
              <label className="inline-flex items-center gap-1.5">
                <span>{t('pagination.rowsPerPage')}</span>
                <select
                  value={pageSize}
                  onChange={(e) =>
                    setPageSize(
                      Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number],
                    )
                  }
                  className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-700 focus:outline-none focus:border-info-500"
                >
                  {PAGE_SIZE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
              <span>
                <span className="font-semibold text-neutral-900 tabular-nums">
                  {t('pagination.range', { start: rangeStart, end: rangeEnd })}
                </span>{' '}
                {t('pagination.of')}{' '}
                <span className="font-semibold text-neutral-900 tabular-nums">
                  {displayRows.length.toLocaleString()}
                </span>
                {displayTotal > displayRows.length && (
                  <span className="text-neutral-400">
                    {t('pagination.totalSuffix', { total: displayTotal.toLocaleString() })}
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <PageButton
                ariaLabel={t('pagination.firstPage')}
                disabled={page === 1}
                onClick={() => setPage(1)}
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </PageButton>
              <PageButton
                ariaLabel={t('pagination.prevPage')}
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </PageButton>

              <div className="flex items-center gap-1 px-1">
                {pageNumbers(page, pageCount).map((p, i) =>
                  p === null ? (
                    <span key={`gap-${i}`} className="px-1 text-neutral-400">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={cn(
                        'min-w-[28px] h-7 rounded-md px-2 text-xs font-medium tabular-nums transition-colors',
                        p === page
                          ? 'bg-neutral-900 text-white'
                          : 'text-neutral-700 hover:bg-neutral-100',
                      )}
                    >
                      {p}
                    </button>
                  ),
                )}
              </div>

              <PageButton
                ariaLabel={t('pagination.nextPage')}
                disabled={page === pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </PageButton>
              <PageButton
                ariaLabel={t('pagination.lastPage')}
                disabled={page === pageCount}
                onClick={() => setPage(pageCount)}
              >
                <ChevronsRight className="h-3.5 w-3.5" />
              </PageButton>

              {hasMore && (
                <>
                  <span className="mx-2 text-neutral-300">·</span>
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="text-xs font-medium text-info-500 hover:underline disabled:opacity-50"
                  >
                    {loadingMore ? t('pagination.loadingMore') : t('pagination.loadMore')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PresetChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100"
    >
      {label}
    </button>
  );
}

function PageButton({
  ariaLabel,
  disabled,
  onClick,
  children,
}: {
  ariaLabel: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors',
        disabled
          ? 'text-neutral-300 cursor-not-allowed'
          : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
      )}
    >
      {children}
    </button>
  );
}

/**
 * Build a compact page-number list with ellipses, e.g.:
 *   page 1 of 10  → 1 2 3 4 5 … 10
 *   page 5 of 10  → 1 … 4 5 6 … 10
 *   page 9 of 10  → 1 … 6 7 8 9 10
 */
function pageNumbers(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | null)[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) pages.push(null);
  for (let p = left; p <= right; p++) pages.push(p);
  if (right < total - 1) pages.push(null);
  pages.push(total);
  return pages;
}
