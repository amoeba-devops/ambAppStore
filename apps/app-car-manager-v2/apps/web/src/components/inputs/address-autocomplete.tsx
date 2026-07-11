'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, MapPin } from 'lucide-react';
import { Input, cn } from '@car-v2/ui';
import { apiPath } from '@/lib/base-path';

interface Prediction {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  fullText: string;
}

interface AddressAutocompleteProps {
  value: string;
  /** Called with the final string the input should display. Optionally also
   *  passes the Google place_id when the user picks from the dropdown — caller
   *  can store this for cleaner Maps URLs later. */
  onChange: (value: string, placeId?: string) => void;
  placeholder?: string;
  error?: boolean;
  maxLength?: number;
  /** Disable autocomplete entirely — useful as a kill-switch if API quota hit. */
  disabled?: boolean;
}

/**
 * Address input with Google Places (New) autocomplete via our /api/v1/places
 * server proxy. Falls back to plain text input if the API returns an error —
 * user can always still type freely.
 *
 * Keyboard:
 *  - ↑ / ↓  navigate suggestions
 *  - Enter  pick highlighted
 *  - Esc    close dropdown
 */
export function AddressAutocomplete({
  value,
  onChange,
  placeholder,
  error,
  maxLength,
  disabled,
}: AddressAutocompleteProps) {
  const t = useTranslations('address');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [fetchFailed, setFetchFailed] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  /** Google session token — same across keystrokes in one autocomplete session.
   *  Reset after a selection to start a new session and cap cost. */
  const sessionTokenRef = useRef<string>(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()));
  /** Latest typed value, used by the in-flight fetch to bail if user kept typing. */
  const latestQueryRef = useRef(value);
  const listboxId = useId();

  /* ── Debounced fetch ──────────────────────────────────────────────────── */
  useEffect(() => {
    latestQueryRef.current = value;
    if (disabled) return;
    const q = value.trim();
    if (q.length < 2) {
      setPredictions([]);
      setOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(apiPath('/api/v1/places/autocomplete'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: q,
            sessionToken: sessionTokenRef.current,
            languageCode: locale,
          }),
        });
        const data = await res.json();
        if (latestQueryRef.current !== value) return; // stale, user kept typing
        if (data?.success && Array.isArray(data.data)) {
          setPredictions(data.data);
          setOpen(true);
          setActiveIndex(-1);
          setFetchFailed(false);
        } else {
          setFetchFailed(true);
          setPredictions([]);
        }
      } catch {
        setFetchFailed(true);
        setPredictions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [value, locale, disabled]);

  /* ── Click outside closes ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const handleSelect = (p: Prediction) => {
    onChange(p.fullText, p.placeId);
    setOpen(false);
    setActiveIndex(-1);
    /* Start fresh session for the next autocomplete cycle. */
    sessionTokenRef.current = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Math.random());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || predictions.length === 0) {
      if (e.key === 'ArrowDown' && predictions.length > 0) {
        setOpen(true);
        setActiveIndex(0);
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % predictions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? predictions.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && predictions[activeIndex]) {
        e.preventDefault();
        handleSelect(predictions[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showHint = open && predictions.length === 0 && !loading;

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => predictions.length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        error={error}
        maxLength={maxLength}
        iconLeft={<MapPin />}
        iconRight={loading ? <Loader2 className="animate-spin" /> : undefined}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
        autoComplete="off"
      />
      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute top-full left-0 right-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-md border border-border bg-surface shadow-pop"
        >
          {predictions.length > 0 ? predictions.map((p, idx) => (
            <li key={p.placeId} id={`${listboxId}-${idx}`} role="option" aria-selected={idx === activeIndex}>
              <button
                type="button"
                onClick={() => handleSelect(p)}
                onMouseEnter={() => setActiveIndex(idx)}
                className={cn(
                  'w-full text-left px-3 py-2 transition-colors',
                  idx === activeIndex ? 'bg-surface-2' : 'hover:bg-surface-2',
                  'focus:outline-none',
                )}
              >
                <div className="text-sm font-medium text-text truncate">{p.primaryText}</div>
                {p.secondaryText && (
                  <div className="text-xs text-text-faint truncate">{p.secondaryText}</div>
                )}
              </button>
            </li>
          )) : showHint && (
            <li className="px-3 py-2 text-xs text-text-faint italic">
              {fetchFailed ? t('errorLoading') : value.trim().length < 2 ? t('typeMore') : t('noResults')}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
