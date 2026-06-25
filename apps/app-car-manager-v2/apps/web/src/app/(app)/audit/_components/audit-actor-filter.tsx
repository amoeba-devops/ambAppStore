'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Avatar,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@car-v2/ui';

interface AuditActorFilterProps {
  /** Distinct actors trong tenant (ent-scoped từ server). */
  actors: Array<{ id: string; name: string | null; email: string | null }>;
  /** Current ?actor=... value đã whitelist-verified bởi server. */
  currentActorId: string | undefined;
  /** Label cho option "Tất cả" — reset filter. */
  allLabel: string;
  placeholder: string;
}

/* Actor (người thực hiện) filter cho audit page.
 *
 * URL contract: ?actor=<usr_id>. Server đọc + whitelist verify (chỉ chấp nhận
 * ID có trong danh sách actor đã ent-scoped) — chặn URL-injection để view audit
 * tenant khác.
 *
 * Preserve các param khác (q, page) khi đổi actor.
 *
 * Reset value via Select khó (Radix không có "clear" native) — dùng sentinel
 * `__ALL__` cho option "Tất cả": khi chọn nó, router.replace remove ?actor. */
const ALL_VALUE = '__ALL__';

export function AuditActorFilter({
  actors,
  currentActorId,
  allLabel,
  placeholder,
}: AuditActorFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (next: string) => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    if (!next || next === ALL_VALUE) params.delete('actor');
    else params.set('actor', next);
    params.delete('page'); // reset pagination khi filter đổi
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <Select value={currentActorId ?? ALL_VALUE} onValueChange={handleChange}>
      <SelectTrigger className="w-full sm:w-56 min-w-0 h-9">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>
          <span className="text-sm text-text-muted">{allLabel}</span>
        </SelectItem>
        {actors.map((a) => {
          const displayName = a.name?.trim() || a.email?.split('@')[0] || a.id.slice(0, 8);
          return (
            <SelectItem key={a.id} value={a.id}>
              <div className="flex items-center gap-2 min-w-0">
                <Avatar name={displayName} size="xs" />
                <span className="text-sm font-medium text-text truncate">{displayName}</span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
