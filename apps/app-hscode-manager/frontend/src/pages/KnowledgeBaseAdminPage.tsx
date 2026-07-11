import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import {
  useCreateKbCategory,
  useCreateKbTag,
  useDeleteKbCategory,
  useDeleteKbTag,
  useKbCategories,
  useKbTags,
} from '@/hooks/useKnowledgeBase';

/** SCR-KB-05 — 카테고리/태그 관리. @SuperAdminOnly. FR-KB-015 (태그·대시보드 편집은 Phase 2/5). */
export default function KnowledgeBaseAdminPage() {
  const { t } = useTranslation('hscode');
  const { data: categories } = useKbCategories();
  const createCat = useCreateKbCategory();
  const delCat = useDeleteKbCategory();

  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366F1');

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createCat.mutate(
      { cat_name: name.trim(), cat_dot_color: color, cat_sort_order: categories?.length ?? 0 },
      { onSuccess: () => setName('') },
    );
  };

  return (
    <div className="py-6">
      <h1 className="mb-4 text-xl font-extrabold text-ink">🔒 {t('kb.manage')}</h1>

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="mb-3 text-sm font-bold text-ink">{t('kb.categories')}</h2>

        <ul className="mb-4 divide-y divide-line">
          {categories?.map((c) => (
            <li key={c.catId} className="flex items-center justify-between py-2">
              <span className="flex items-center gap-2 text-sm text-ink">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: c.dotColor || '#94a3b8' }}
                />
                {c.name}
              </span>
              <button
                onClick={() => window.confirm(t('kb.confirmDelete')) && delCat.mutate(c.catId)}
                className="text-muted hover:text-bad"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
          {categories?.length === 0 && <li className="py-2 text-xs text-muted">{t('kb.empty')}</li>}
        </ul>

        <form onSubmit={onAdd} className="flex items-center gap-2">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-10 rounded border border-line2"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('kb.categoryName')}
            className="flex-1 rounded-lg border border-line2 px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <button
            type="submit"
            disabled={createCat.isPending}
            className="flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            <Plus size={15} /> {t('kb.add')}
          </button>
        </form>
      </section>

      <TagManager />
    </div>
  );
}

const TAG_TYPES = ['COUNTRY', 'HS_CHAPTER'] as const;

/** 태그 관리(FR-KB-013) — 국가/HS 챕터 태그 생성·삭제. */
function TagManager() {
  const { t } = useTranslation('hscode');
  const { data: tags } = useKbTags();
  const createTag = useCreateKbTag();
  const delTag = useDeleteKbTag();
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('COUNTRY');

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createTag.mutate({ tag_name: name.trim(), tag_type: type }, { onSuccess: () => setName('') });
  };

  return (
    <section className="mt-4 rounded-xl border border-line bg-white p-5">
      <h2 className="mb-3 text-sm font-bold text-ink">{t('kb.tags')}</h2>
      <div className="mb-4 space-y-2">
        {TAG_TYPES.map((tt) => (
          <div key={tt} className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-bold text-muted">{tt}</span>
            {tags
              ?.filter((tg) => tg.type === tt)
              .map((tg) => (
                <span
                  key={tg.tagId}
                  className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-ink"
                >
                  #{tg.name}
                  <button onClick={() => delTag.mutate(tg.tagId)} className="text-muted hover:text-bad">
                    <Trash2 size={11} />
                  </button>
                </span>
              ))}
          </div>
        ))}
      </div>
      <form onSubmit={onAdd} className="flex items-center gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-lg border border-line2 px-2 py-2 text-sm"
        >
          {TAG_TYPES.map((tt) => (
            <option key={tt} value={tt}>
              {tt}
            </option>
          ))}
        </select>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('kb.tagName')}
          className="flex-1 rounded-lg border border-line2 px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={createTag.isPending}
          className="flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          <Plus size={15} /> {t('kb.add')}
        </button>
      </form>
    </section>
  );
}
