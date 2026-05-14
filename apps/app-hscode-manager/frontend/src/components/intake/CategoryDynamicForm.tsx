import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import type { CategorySchema, FieldSpec, ItemCategory } from '@/types/inquiry.types';

interface Props {
  schema: CategorySchema;
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

function getLabel(field: FieldSpec, lang: string): string {
  if (lang === 'en') return field.label_en;
  if (lang === 'vi') return field.label_vi;
  return field.label_ko;
}

export function CategoryDynamicForm({ schema, values, onChange }: Props) {
  const { i18n } = useTranslation();
  const lang = i18n.language;

  const set = (key: string, v: unknown) => onChange({ ...values, [key]: v });

  const renderField = (f: FieldSpec) => {
    const label = getLabel(f, lang);
    const required = f.required;
    const v = values[f.key];

    if (f.type === 'enum') {
      return (
        <label key={f.key} className="block text-sm">
          <span className="text-gray-600">
            {label} {required && <span className="text-red-500">*</span>}
          </span>
          <select
            className="input mt-1"
            value={(v as string) ?? ''}
            onChange={(e) => set(f.key, e.target.value || undefined)}
          >
            <option value="">—</option>
            {f.enum_values?.map((ev) => (
              <option key={ev} value={ev}>
                {ev}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (f.type === 'number') {
      return (
        <label key={f.key} className="block text-sm">
          <span className="text-gray-600">
            {label}
            {f.unit && <span className="text-gray-400"> ({f.unit})</span>}
            {required && <span className="text-red-500"> *</span>}
          </span>
          <input
            type="number"
            className="input mt-1"
            value={v === undefined || v === null ? '' : String(v)}
            onChange={(e) =>
              set(f.key, e.target.value === '' ? undefined : Number(e.target.value))
            }
          />
        </label>
      );
    }

    if (f.type === 'array') {
      const arr = Array.isArray(v) ? v : [];
      // composition 특수 처리 (CAS + percent)
      if (f.key === 'composition') {
        return (
          <div key={f.key} className="text-sm">
            <span className="text-gray-600">
              {label} {required && <span className="text-red-500">*</span>}
              {f.hint && <span className="ml-1 text-xs text-gray-400">— {f.hint}</span>}
            </span>
            <div className="mt-1 space-y-2">
              {arr.map((c: Record<string, unknown>, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder="CAS"
                    value={(c.cas as string) ?? ''}
                    onChange={(e) => {
                      const next = [...arr];
                      next[i] = { ...c, cas: e.target.value };
                      set(f.key, next);
                    }}
                  />
                  <input
                    type="number"
                    className="input w-24"
                    placeholder="%"
                    value={c.percent === undefined ? '' : String(c.percent)}
                    onChange={(e) => {
                      const next = [...arr];
                      next[i] = {
                        ...c,
                        percent: e.target.value === '' ? null : Number(e.target.value),
                      };
                      set(f.key, next);
                    }}
                  />
                  <button
                    type="button"
                    className="px-2 text-gray-400 hover:text-red-600"
                    onClick={() => set(f.key, arr.filter((_: unknown, idx) => idx !== i))}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => set(f.key, [...arr, { cas: '', percent: null }])}
              >
                <Plus className="mr-1 inline-block h-3 w-3" /> +
              </button>
            </div>
          </div>
        );
      }
      // generic array
      const flat = arr as string[];
      return (
        <div key={f.key} className="text-sm">
          <span className="text-gray-600">
            {label} {required && <span className="text-red-500">*</span>}
          </span>
          <div className="mt-1 space-y-1">
            {flat.map((item, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="input flex-1"
                  value={String(item)}
                  onChange={(e) => {
                    const next = [...flat];
                    next[i] = e.target.value;
                    set(f.key, next);
                  }}
                />
                <button
                  type="button"
                  className="px-2 text-gray-400 hover:text-red-600"
                  onClick={() => set(f.key, flat.filter((_, idx) => idx !== i))}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => set(f.key, [...flat, ''])}
            >
              <Plus className="mr-1 inline-block h-3 w-3" /> +
            </button>
          </div>
        </div>
      );
    }

    if (f.type === 'object') {
      // alloy_elements: { Cr: 18, Ni: 8 }
      const obj = (v as Record<string, number>) ?? {};
      const entries = Object.entries(obj);
      return (
        <div key={f.key} className="text-sm">
          <span className="text-gray-600">
            {label} {required && <span className="text-red-500">*</span>}
            {f.hint && <span className="ml-1 text-xs text-gray-400">— {f.hint}</span>}
          </span>
          <div className="mt-1 space-y-1">
            {entries.map(([k, val], i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="input w-24"
                  placeholder="key"
                  value={k}
                  onChange={(e) => {
                    const next: Record<string, number> = {};
                    Object.entries(obj).forEach(([k2, v2], idx) => {
                      next[idx === i ? e.target.value : k2] = v2;
                    });
                    set(f.key, next);
                  }}
                />
                <input
                  type="number"
                  className="input w-24"
                  placeholder="%"
                  value={String(val)}
                  onChange={(e) =>
                    set(f.key, { ...obj, [k]: Number(e.target.value) })
                  }
                />
                <button
                  type="button"
                  className="px-2 text-gray-400 hover:text-red-600"
                  onClick={() => {
                    const next = { ...obj };
                    delete next[k];
                    set(f.key, next);
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => set(f.key, { ...obj, '': 0 })}
            >
              <Plus className="mr-1 inline-block h-3 w-3" /> +
            </button>
          </div>
        </div>
      );
    }

    return (
      <label key={f.key} className="block text-sm">
        <span className="text-gray-600">
          {label} {required && <span className="text-red-500">*</span>}
          {f.hint && <span className="ml-1 text-xs text-gray-400">— {f.hint}</span>}
        </span>
        {f.key === 'usage_description' ? (
          <textarea
            className="input mt-1"
            rows={3}
            value={(v as string) ?? ''}
            onChange={(e) => set(f.key, e.target.value)}
          />
        ) : (
          <input
            className="input mt-1"
            value={(v as string) ?? ''}
            onChange={(e) => set(f.key, e.target.value)}
          />
        )}
      </label>
    );
  };

  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          common
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {schema.common_fields.map(renderField)}
        </div>
      </section>

      {schema.required_fields.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            required ({schema.category})
          </h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {schema.required_fields.map(renderField)}
          </div>
        </section>
      )}

      {schema.optional_fields.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            optional
          </h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {schema.optional_fields.map(renderField)}
          </div>
        </section>
      )}
    </div>
  );
}

export function CategoryHint({ category }: { category: ItemCategory }) {
  const { t } = useTranslation('intake');
  return (
    <p className="text-xs text-gray-500">
      {t(`direct.categories.${category}`)}
    </p>
  );
}
