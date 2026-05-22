'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Input } from '@car-v2/ui';

interface DebouncedSearchProps {
  /** URL search param name. Default 'q'. */
  paramName?: string;
  placeholder?: string;
  /** Debounce delay in ms. Default 300. */
  delayMs?: number;
  className?: string;
  /** Aria-label for clear button. */
  clearLabel?: string;
}

/**
 * Search input đồng nhất cho toàn app:
 *   - Debounce 300ms khi user gõ → tự động cập nhật URL `?q=<value>`
 *   - Clear button (X) hiện bên phải khi input có giá trị → bấm reset cả input + URL
 *   - Giữ nguyên các search params khác (status, date, page, ...) — quan trọng cho
 *     các page có filter chính phụ song song
 *   - Dùng `router.replace` + `scroll: false`: không bloat history, không jump
 *     scroll mỗi keystroke
 *   - Skip URL update nếu giá trị không đổi (đề phòng re-render loop)
 *
 * Server đọc giá trị qua `searchParams.q` (RSC) hoặc `useSearchParams().get('q')`
 * (client). Hoạt động với cả server-side filter (drizzle ILIKE) lẫn client-side
 * filter (array.filter) — chỉ là URL contract.
 */
export function DebouncedSearchInput({
  paramName = 'q',
  placeholder,
  delayMs = 300,
  className,
  clearLabel = 'Xoá',
}: DebouncedSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlValue = searchParams.get(paramName) ?? '';

  /* Local state đại diện cho input — debounced commit lên URL. */
  const [value, setValue] = useState(urlValue);
  const lastCommittedRef = useRef(urlValue);

  /* Sync local state nếu URL bị đổi từ ngoài (nút Clear button khác, browser
   * back/forward, link với ?q=...). Bỏ qua trường hợp local state đã trùng
   * URL — tránh override khi user đang gõ nhanh hơn debounce. */
  useEffect(() => {
    if (urlValue !== lastCommittedRef.current) {
      lastCommittedRef.current = urlValue;
      setValue(urlValue);
    }
  }, [urlValue]);

  /* Debounce commit. Cancel timer cũ khi value đổi tiếp. */
  useEffect(() => {
    if (value === lastCommittedRef.current) return;
    const handle = setTimeout(() => {
      commit(value);
    }, delayMs);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delayMs]);

  /* Push URL. Clone existing params để preserve status/date/page... Trim value;
   * empty → xoá param hoàn toàn cho clean URL. Page bị reset khi search đổi —
   * trang 5 với query cũ không có nghĩa cho query mới. */
  const commit = (next: string) => {
    const trimmed = next.trim();
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    if (trimmed) params.set(paramName, trimmed);
    else params.delete(paramName);
    params.delete('page'); // reset pagination on new search
    lastCommittedRef.current = trimmed;
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const handleClear = () => {
    setValue('');
    commit('');
  };

  return (
    <Input
      type="search"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={placeholder}
      iconLeft={<Search />}
      iconRight={
        value ? (
          <button
            type="button"
            aria-label={clearLabel}
            onClick={handleClear}
            className="inline-flex items-center justify-center h-5 w-5 rounded text-text-faint hover:text-text hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : undefined
      }
      className={className}
    />
  );
}
