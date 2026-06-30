import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ScreenHeader from '@/components/common/ScreenHeader';
import SubTabs from '@/components/common/SubTabs';
import { useSaveSettings, useSettings } from '@/hooks/useAdmin';
import { adminSettingsService } from '@/services/admin-settings.service';
import type { SettingCategory } from '@/types/admin.types';

interface FieldDef {
  key: string;
  labelKey: string;
  secret?: boolean;
  type?: string;
}

const FIELDS: Record<SettingCategory, FieldDef[]> = {
  AI: [
    { key: 'api_key', labelKey: 'set.ai.key', secret: true },
    { key: 'model_version', labelKey: 'set.ai.model' },
    { key: 'daily_budget', labelKey: 'set.ai.budget', type: 'number' },
  ],
  EXTERNAL: [
    { key: 'gs1_endpoint', labelKey: 'set.ext.endpoint' },
    { key: 'cache_ttl', labelKey: 'set.ext.ttl', type: 'number' },
  ],
  EMBEDDING: [
    { key: 'provider', labelKey: 'set.emb.provider' },
    { key: 'dimensions', labelKey: 'set.emb.dim', type: 'number' },
  ],
  THRESHOLD: [
    { key: 'gap', labelKey: 'set.thr.gap', type: 'number' },
    { key: 'review', labelKey: 'set.thr.review', type: 'number' },
    { key: 'flag', labelKey: 'set.thr.flag', type: 'number' },
    { key: 'max_rounds', labelKey: 'set.thr.rounds', type: 'number' },
  ],
};

const TABS: { key: SettingCategory; labelKey: string }[] = [
  { key: 'AI', labelKey: 'set.tab.ai' },
  { key: 'EXTERNAL', labelKey: 'set.tab.ext' },
  { key: 'EMBEDDING', labelKey: 'set.tab.embed' },
  { key: 'THRESHOLD', labelKey: 'set.tab.thr' },
];

export default function AdminSettingsPage() {
  const { t } = useTranslation('hscode');
  const [tab, setTab] = useState<SettingCategory>('AI');

  return (
    <section>
      <ScreenHeader id="SCR-006" title={t('set.title')} sub={t('set.sub')} />
      <SubTabs
        tabs={TABS.map((x) => ({ key: x.key, label: t(x.labelKey) }))}
        active={tab}
        onChange={(k) => setTab(k as SettingCategory)}
      />
      <SettingsForm key={tab} category={tab} />
    </section>
  );
}

function SettingsForm({ category }: { category: SettingCategory }) {
  const { t } = useTranslation('hscode');
  const { data } = useSettings(category);
  const save = useSaveSettings();
  const [values, setValues] = useState<Record<string, string>>({});
  const [placeholders, setPlaceholders] = useState<Record<string, string>>({});
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const fields = FIELDS[category];

  useEffect(() => {
    if (!data) return;
    const next: Record<string, string> = {};
    const ph: Record<string, string> = {};
    for (const f of fields) {
      const found = data.find((s) => s.key === f.key);
      if (f.secret) ph[f.key] = found?.value ?? '';
      else next[f.key] = found?.value ?? '';
    }
    setValues(next);
    setPlaceholders(ph);
  }, [data, category]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSave = () => {
    const items = fields.map((f) => ({
      key: f.key,
      value: values[f.key],
      is_secret: f.secret,
    }));
    save.mutate({ category, items });
  };

  return (
    <div className="mt-4 rounded-xl border border-line bg-white p-5">
      <h3 className="mb-3.5 text-[14.5px] font-semibold">{t(`set.tab.${category.toLowerCase()}`)}</h3>

      {fields.map((f) => (
        <label key={f.key} className="mb-3 block text-xs font-bold text-muted">
          {t(f.labelKey)}
          <input
            type={f.type ?? 'text'}
            value={values[f.key] ?? ''}
            placeholder={f.secret ? placeholders[f.key] || '••••' : ''}
            onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            className="fld-input"
          />
        </label>
      ))}

      <div className="mt-2 flex justify-end gap-2">
        {category === 'AI' && (
          <button
            onClick={async () => {
              const res = await adminSettingsService.test();
              setTestMsg(res.message);
            }}
            className="rounded-s border border-line2 bg-white px-3 py-1.5 text-[12.5px] font-semibold hover:border-brand-light"
          >
            {t('set.test')}
          </button>
        )}
        <button
          onClick={onSave}
          disabled={save.isPending}
          className="rounded-s bg-brand px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-brand-dark disabled:opacity-45"
        >
          {t('set.save')}
        </button>
      </div>

      {testMsg && <p className="mt-2 text-right text-[12px] text-muted">{testMsg}</p>}

      <div className="mt-3.5 flex items-start gap-2.5 rounded-[9px] border border-[#BBD6FA] bg-info-soft px-3.5 py-3 text-[12.5px] text-[#1E5BB8]">
        <span>🔒</span>
        <div>{t('set.secretnote')}</div>
      </div>
    </div>
  );
}
