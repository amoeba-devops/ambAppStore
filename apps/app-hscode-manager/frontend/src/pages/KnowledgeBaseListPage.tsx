import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, Pin, Plus, Search } from 'lucide-react';
import { useKbCategories, useKbPosts } from '@/hooks/useKnowledgeBase';
import { useAuthStore } from '@/stores/auth.store';

const PAGE_SIZE = 20;

/** SCR-KB-02 — 게시판 목록(카테고리별) + 검색/필터 + 페이지네이션. FR-KB-001/004 */
export default function KnowledgeBaseListPage() {
  const { t } = useTranslation('hscode');
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin());
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryId = searchParams.get('category_id') ?? undefined;
  const [q, setQ] = useState('');
  const [submittedQ, setSubmittedQ] = useState('');
  const [page, setPage] = useState(1);

  const { data: categories } = useKbCategories();
  const { data, isLoading } = useKbPosts({
    q: submittedQ || undefined,
    category_id: categoryId,
    page,
    page_size: PAGE_SIZE,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const activeCategory = categories?.find((c) => c.catId === categoryId);

  return (
    <div className="py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-ink">
          {t('kb.title')}
          {activeCategory && <span className="text-muted"> › {activeCategory.name}</span>}
        </h1>
        {isSuperAdmin && (
          <Link
            to="/knowledge-base/posts/new"
            className="flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-sm font-bold text-white hover:bg-brand-dark"
          >
            <Plus size={15} /> {t('kb.newPost')}
          </Link>
        )}
      </div>

      {/* 검색 + 카테고리 필터 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSubmittedQ(q);
          }}
          className="flex flex-1 items-center gap-2 rounded-lg border border-line2 px-3 py-2"
        >
          <Search size={15} className="text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('kb.searchPh')}
            className="flex-1 text-sm outline-none"
          />
        </form>
        <select
          value={categoryId ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            setPage(1);
            setSearchParams(v ? { category_id: v } : {});
          }}
          className="rounded-lg border border-line2 px-3 py-2 text-sm"
        >
          <option value="">{t('kb.allCategories')}</option>
          {categories?.map((c) => (
            <option key={c.catId} value={c.catId}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-sm text-muted">{t('common.loading')}</p>}

      {data && (
        <>
          <div className="divide-y divide-line rounded-xl border border-line bg-white">
            {data.items.length === 0 && (
              <p className="p-6 text-center text-sm text-muted">{t('kb.noPosts')}</p>
            )}
            {data.items.map((p) => (
              <Link
                key={p.pstId}
                to={`/knowledge-base/posts/${p.pstId}`}
                className="block px-4 py-3 hover:bg-gray-50"
              >
                <div className="flex items-center gap-2">
                  {p.isPinned && <Pin size={13} className="text-brand" />}
                  <span className="font-semibold text-ink">{p.title}</span>
                  {p.categoryName && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-muted">
                      {p.categoryName}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-3 text-[11px] text-muted">
                  {p.tags.map((tag) => (
                    <span key={tag.tagId}>#{tag.name}</span>
                  ))}
                  <span className="ml-auto flex items-center gap-0.5">
                    <Eye size={11} /> {p.viewCount}
                  </span>
                  <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="mt-4 flex justify-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((v) => v - 1)}
                className="rounded border border-line2 px-2.5 py-1 text-sm disabled:opacity-40"
              >
                ◀
              </button>
              <span className="px-3 py-1 text-sm text-muted">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((v) => v + 1)}
                className="rounded border border-line2 px-2.5 py-1 text-sm disabled:opacity-40"
              >
                ▶
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
