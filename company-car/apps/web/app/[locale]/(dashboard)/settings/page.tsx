'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch, ClientApiError } from '@/lib/client/api';
import { Save } from 'lucide-react';

type Setting = {
  key: string;
  value: unknown;
  description: string | null;
  updatedBy: string | null;
  updatedAt: string;
};

const HUMAN_LABELS: Record<string, string> = {
  auto_approve_threshold_fuel: 'Auto-approve threshold — Fuel (VND)',
  auto_approve_threshold_meal: 'Auto-approve threshold — Meal (VND)',
  auto_approve_threshold_oil: 'Auto-approve threshold — Oil change (VND)',
  default_trip_duration_hours: 'Default trip duration (hours)',
  oil_change_warning_km: 'Oil change warning threshold (km)',
  license_expiry_warning_days: 'License expiry warning (days)',
  sso_google_enabled: 'Google SSO enabled',
};

export default function SettingsPage() {
  const t = useTranslations();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const rows = await apiFetch<Setting[]>('/api/settings');
      setSettings(rows);
      const init: Record<string, string> = {};
      for (const s of rows) init[s.key] = stringifyValue(s.value);
      setEdits(init);
    } catch (err) {
      if (err instanceof ClientApiError) setError(`${err.code}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(key: string) {
    setSavingKey(key);
    setError(null);
    setSavedKey(null);
    try {
      const raw = edits[key] ?? '';
      const value = parseValue(raw);
      await apiFetch(`/api/settings/${key}`, {
        method: 'PATCH',
        body: JSON.stringify({ value }),
      });
      setSavedKey(key);
      await load();
    } catch (err) {
      if (err instanceof ClientApiError) setError(`${err.code}: ${err.message}`);
      else setError('Save failed');
    } finally {
      setSavingKey(null);
      setTimeout(() => setSavedKey(null), 2000);
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{t('nav.settings')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Admin-only system configuration. Changes are audit-logged.
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <ul className="space-y-3">
        {settings.map((s) => (
          <li key={s.key} className="rounded-2xl border border-border bg-background p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1">
                <h3 className="text-sm font-medium">
                  {HUMAN_LABELS[s.key] ?? s.key}
                </h3>
                {s.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                )}
                <p className="mt-1 font-mono text-xs text-muted-foreground">{s.key}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {typeof s.value === 'boolean' ? (
                  <select
                    value={edits[s.key] ?? ''}
                    onChange={(e) => setEdits((x) => ({ ...x, [s.key]: e.target.value }))}
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : (
                  <input
                    value={edits[s.key] ?? ''}
                    onChange={(e) => setEdits((x) => ({ ...x, [s.key]: e.target.value }))}
                    className="w-40 rounded-lg border border-border bg-background px-3 py-1.5 text-sm tabular-nums"
                  />
                )}
                <button
                  onClick={() => save(s.key)}
                  disabled={savingKey === s.key}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
                >
                  <Save className="h-3 w-3" />
                  {savingKey === s.key ? '...' : 'Save'}
                </button>
                {savedKey === s.key && <span className="text-xs text-green-600">✓</span>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function stringifyValue(v: unknown): string {
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

function parseValue(raw: string): unknown {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const n = Number(raw);
  if (!isNaN(n) && raw.trim() !== '') return n;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
