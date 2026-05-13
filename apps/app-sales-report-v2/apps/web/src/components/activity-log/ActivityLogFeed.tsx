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
} from 'lucide-react';
import { cn } from '@v2/ui';
import {
  listActionLogsAction,
  exportActionLogsAction,
  type ActionLogRow,
} from '@/server/actions/action-log.actions';
import { getMockActionLogs, subscribeMockLog } from '@/lib/action-log-mock';

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

function CategoryPill({ category }: { category: Category }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
        CATEGORY_PILL[category],
      )}
    >
      <span className={cn('inline-block h-1.5 w-1.5 rounded-full', CATEGORY_DOT[category])} />
      {CATEGORY_LABEL[category]}
    </span>
  );
}

const CATEGORY_LABEL: Record<Category, string> = {
  UPLOAD: 'Upload',
  APPROVAL: 'Approval',
  MANUAL_INPUT: 'Manual input',
  MASTER_DATA: 'Master data',
  FORMULA: 'Formula',
  REPORT: 'Report',
  EXPORT: 'Export',
  OTHER: 'Other',
};

const ROLE_LABEL: Record<string, string> = {
  OPERATOR: 'Operator',
  MANAGER: 'Manager',
  ADMIN: 'Admin',
};

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

function formatDayHeader(dayKey: string): string {
  const d = new Date(dayKey + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return dayKey;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - 86_400_000);
  const dayDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const human = dayDate.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  if (dayDate.getTime() === today.getTime()) return `Today · ${human}`;
  if (dayDate.getTime() === yesterday.getTime()) return `Yesterday · ${human}`;
  return human;
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
  const [rows, setRows] = useState<ActionLogRow[]>(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [search, setSearch] = useState('');
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
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
    const all = getMockActionLogs();
    const q = search.trim().toLowerCase();
    return all.filter((r) => {
      if (activeCategories.size > 0 && !activeCategories.has(r.category as Category)) return false;
      if (!q) return true;
      const hay =
        `${r.username} ${r.verb} ${r.targetLabel} ${r.summary ?? ''} ${r.category}`.toLowerCase();
      return hay.includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mockTick, search, activeCategories]);

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
  }, [search, activeCategories, pageSize, displayRows.length === 0]);
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
    async (q: string, cats: Category[]) => {
      setLoading(true);
      const res = await listActionLogsAction({
        search: q || undefined,
        categories: cats.length > 0 ? cats : undefined,
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
      void refresh(search, categoriesArray);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, categoriesArray, refresh]);

  const loadMore = async () => {
    if (!hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    const res = await listActionLogsAction({
      search: search || undefined,
      categories: categoriesArray.length > 0 ? categoriesArray : undefined,
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
    });
    setExporting(false);
    if (!res.success) {
      setFeedback(res.error.message);
      return;
    }
    const blob = new Blob([res.data.csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.data.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleCategory = (c: Category) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
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
            placeholder="user, file, action…"
            className="w-full rounded-md border border-neutral-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none"
          />
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
            Filter
            {activeCategories.size > 0 && (
              <span className="ml-1 rounded-full bg-accent-700 px-1.5 py-0.5 text-[10px] font-mono text-white">
                {activeCategories.size}
              </span>
            )}
          </button>
          {filterOpen && (
            <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-neutral-200 bg-white p-2 shadow-md">
              <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Categories
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
                      <span className="text-neutral-700">{CATEGORY_LABEL[c]}</span>
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
                  Clear all
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
          {exporting ? 'Exporting…' : 'Export'}
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
          Loading…
        </div>
      ) : displayRows.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white px-6 py-10 text-center text-sm text-neutral-500">
          No actions logged yet. Actions you take (uploads, edits, exports) will appear here.
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
                  {dayRows.length} action{dayRows.length !== 1 ? 's' : ''}
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
                        Time
                      </th>
                      <th
                        style={{ width: '128px' }}
                        className="px-3 py-2 text-left font-semibold"
                      >
                        Category
                      </th>
                      <th
                        style={{ width: '200px' }}
                        className="px-3 py-2 text-left font-semibold"
                      >
                        User
                      </th>
                      <th
                        style={{ width: '110px' }}
                        className="px-3 py-2 text-left font-semibold"
                      >
                        Action
                      </th>
                      <th
                        style={{ width: '220px' }}
                        className="px-3 py-2 text-left font-semibold"
                      >
                        Target
                      </th>
                      <th className="px-3 py-2 text-left font-semibold">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {dayRows.map((row) => {
                      const dt = splitDateTime(row.createdAt);
                      return (
                        <tr key={row.actId} className="hover:bg-neutral-50/60 align-top">
                          <td className="px-4 py-3 font-mono text-xs text-neutral-500 tabular-nums whitespace-nowrap">
                            {dt.time}
                          </td>
                          <td className="px-3 py-3">
                            <CategoryPill category={row.category as Category} />
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-mono text-xs text-info-500 truncate">
                              {row.username}
                            </div>
                            <div className="text-[11px] text-neutral-500">
                              {ROLE_LABEL[row.userRole] ?? row.userRole}
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
                              <span className="text-xs text-neutral-300">—</span>
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
                <span>Rows per page</span>
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
                  {rangeStart}–{rangeEnd}
                </span>{' '}
                of{' '}
                <span className="font-semibold text-neutral-900 tabular-nums">
                  {displayRows.length.toLocaleString()}
                </span>
                {displayTotal > displayRows.length && (
                  <span className="text-neutral-400">
                    {' '}
                    ({displayTotal.toLocaleString()} total)
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <PageButton
                ariaLabel="First page"
                disabled={page === 1}
                onClick={() => setPage(1)}
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </PageButton>
              <PageButton
                ariaLabel="Previous page"
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
                ariaLabel="Next page"
                disabled={page === pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </PageButton>
              <PageButton
                ariaLabel="Last page"
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
                    {loadingMore ? 'Loading…' : 'Load more from server'}
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
