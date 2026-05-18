'use client';

import { useEffect, useRef, useState } from 'react';
import type { ConflictResult } from '@/server/services/trip-conflict.service';

interface UseTripConflictsInput {
  vehicleId: string | null;
  driverId: string | null;
  /** ISO string. Empty → skip check. */
  scheduledAtIso: string;
  durationMinutes: number | null;
  excludeTripId?: string;
  /** Pause the hook entirely (e.g. dialog closed). */
  enabled?: boolean;
}

interface UseTripConflictsResult {
  conflicts: ConflictResult | null;
  loading: boolean;
  error: boolean;
}

const EMPTY: ConflictResult = { vehicle: [], driver: [] };

/**
 * Debounced (500ms) lookup of vehicle/driver schedule conflicts.
 *
 * Mỗi lần input thay đổi → reset state, đợi 500ms, fire POST. Request cũ
 * được abort qua AbortController để không race nhau. Trả `loading=true`
 * trong cửa sổ debounce + in-flight để UI hiển thị skeleton/spinner.
 *
 * Khi không đủ input (thiếu cả vehicle lẫn driver, hoặc scheduledAt empty)
 * → trả `conflicts = EMPTY` ngay, không gọi API.
 */
export function useTripConflicts(input: UseTripConflictsInput): UseTripConflictsResult {
  const { vehicleId, driverId, scheduledAtIso, durationMinutes, excludeTripId, enabled = true } = input;

  const [conflicts, setConflicts] = useState<ConflictResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    /* Cancel any in-flight when inputs change or hook unmounts. */
    abortRef.current?.abort();
    abortRef.current = null;

    if (!enabled) {
      setConflicts(null);
      setLoading(false);
      setError(false);
      return;
    }

    /* No assignable + no time → cannot conflict. Reset immediately. */
    if ((!vehicleId && !driverId) || !scheduledAtIso) {
      setConflicts(EMPTY);
      setLoading(false);
      setError(false);
      return;
    }

    /* Optimistically show loading immediately so UI feels responsive. */
    setLoading(true);
    setError(false);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch('/api/v1/trips/check-conflicts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              vehicle_id: vehicleId || null,
              driver_id: driverId || null,
              scheduled_at: scheduledAtIso,
              duration_minutes: durationMinutes,
              exclude_trip_id: excludeTripId,
            }),
            signal: ctrl.signal,
          });
          if (ctrl.signal.aborted) return;
          if (!res.ok) {
            setError(true);
            setConflicts(null);
            setLoading(false);
            return;
          }
          const json = (await res.json()) as
            | { success: true; data: ConflictResult }
            | { success: false; error: { code: string; message: string } };
          if (ctrl.signal.aborted) return;
          if (!json.success) {
            setError(true);
            setConflicts(null);
          } else {
            setConflicts(json.data);
            setError(false);
          }
          setLoading(false);
        } catch (e) {
          if ((e as Error).name === 'AbortError') return;
          setError(true);
          setConflicts(null);
          setLoading(false);
        }
      })();
    }, 500);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [vehicleId, driverId, scheduledAtIso, durationMinutes, excludeTripId, enabled]);

  return { conflicts, loading, error };
}
