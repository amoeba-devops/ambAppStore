'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Plus, Search } from 'lucide-react';
import { cn } from '@v2/ui';
import { FORMULA_SECTIONS } from '@/lib/formula-config-data';

const SHOPEE_OPTIONS = [
  'Shopee Sales CSV',
  'Shopee Traffic CSV',
  'Shopee Ads CSV',
  'Shopee Off-Platform Ads CSV',
  'Shopee Brand Ads CSV',
  'Shopee Affiliate CSV',
];

const TIKTOK_OPTIONS = [
  'TikTok Sales CSV',
  'TikTok Traffic CSV',
  'TikTok Affiliate CSV',
];

const OTHER_OPTIONS = ['Prime Cost Table', 'Manual Input', 'Calculated'];

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
}

export function DataSourceMultiSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (opt: string) => {
    if (value.includes(opt)) {
      onChange(value.filter((v) => v !== opt));
    } else {
      onChange([...value, opt]);
    }
  };

  const remove = (opt: string) => {
    onChange(value.filter((v) => v !== opt));
  };

  const calculatedFields = useMemo(
    () => FORMULA_SECTIONS.flatMap((s) => s.items.map((it) => it.metric)),
    [],
  );

  const q = search.trim().toLowerCase();
  const matchesQ = (s: string) => q === '' || s.toLowerCase().includes(q);

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-md bg-info-50 px-2 py-0.5 text-xs font-medium text-info-500 whitespace-nowrap max-w-[180px]"
          >
            <span className="truncate">{v}</span>
            <button
              type="button"
              onClick={() => remove(v)}
              className="shrink-0 hover:text-info-500/70"
              aria-label={`Remove ${v}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-0.5 rounded-md border border-dashed border-neutral-300 bg-white px-2 py-0.5 text-xs font-medium text-neutral-500 hover:border-neutral-400 hover:text-neutral-700"
        >
          <Plus className="h-2.5 w-2.5" />
          Add
        </button>
      </div>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-80 rounded-md border border-neutral-200 bg-white shadow-lg">
          <div className="p-2 border-b border-neutral-100">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                autoFocus
                className="w-full rounded border border-neutral-300 bg-white py-1 pl-7 pr-2 text-xs placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            <Group label="Shopee" options={SHOPEE_OPTIONS.filter(matchesQ)} value={value} onToggle={toggle} />
            <Group label="TikTok" options={TIKTOK_OPTIONS.filter(matchesQ)} value={value} onToggle={toggle} />
            <Group label="Other" options={OTHER_OPTIONS.filter(matchesQ)} value={value} onToggle={toggle} />
            <Group
              label="Calculated Fields"
              options={calculatedFields.filter(matchesQ)}
              value={value}
              onToggle={toggle}
              mono
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Group({
  label,
  options,
  value,
  onToggle,
  mono,
}: {
  label: string;
  options: string[];
  value: string[];
  onToggle: (opt: string) => void;
  mono?: boolean;
}) {
  if (options.length === 0) return null;
  return (
    <div>
      <div className="sticky top-0 z-10 bg-neutral-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 border-b border-neutral-100">
        {label}
      </div>
      <ul className="py-1">
        {options.map((opt) => {
          const checked = value.includes(opt);
          return (
            <li key={opt}>
              <label
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-neutral-50',
                  checked && 'bg-info-50/40',
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(opt)}
                  className="accent-info-500"
                />
                <span className={cn('flex-1 truncate', mono ? 'font-mono text-xs' : 'text-neutral-700')}>
                  {opt}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
