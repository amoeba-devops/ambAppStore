import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, GripVertical, Pin, Plus, X } from 'lucide-react';
import {
  useCreateKbBlock,
  useDeleteKbBlock,
  useKbLanding,
  useReorderKbBlocks,
} from '@/hooks/useKnowledgeBase';
import { useAuthStore } from '@/stores/auth.store';
import type { KbDashboardBlock } from '@/types/knowledge-base.types';

/** SCR-KB-01 — 지식창고 대시보드(랜딩). 공지/팁/카테고리/최신/인기 + 관리자 인라인 편집. FR-KB-005/006/007 */
export default function KnowledgeBaseDashboardPage() {
  const { t } = useTranslation('hscode');
  const { data, isLoading } = useKbLanding();
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin());
  const [editMode, setEditMode] = useState(false);

  return (
    <div className="py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-ink">{t('kb.title')}</h1>
          <p className="text-sm text-muted">{t('kb.subtitle')}</p>
        </div>
        {isSuperAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => setEditMode((v) => !v)}
              className={
                editMode
                  ? 'rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white'
                  : 'rounded-lg border border-line2 px-3 py-1.5 text-xs font-bold text-muted hover:text-ink'
              }
            >
              🔒 {editMode ? t('kb.done') : t('kb.editMode')}
            </button>
            <Link
              to="/knowledge-base/admin"
              className="rounded-lg border border-line2 px-3 py-1.5 text-xs font-bold text-muted hover:text-ink"
            >
              {t('kb.manage')}
            </Link>
          </div>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted">{t('common.loading')}</p>}

      {data && (
        <div className="space-y-4">
          <NoticeSection notices={data.notices} editMode={editMode} />
          <TipsSection tips={data.tips} editMode={editMode} />

          <div className="grid gap-4 md:grid-cols-3">
            <section className="rounded-xl border border-line bg-white p-4">
              <h2 className="mb-2 text-sm font-bold text-ink">{t('kb.categories')}</h2>
              <ul className="space-y-1.5">
                {data.categories.map((c) => (
                  <li key={c.catId}>
                    <Link
                      to={`/knowledge-base/posts?category_id=${c.catId}`}
                      className="flex items-center gap-2 text-sm text-ink hover:text-brand"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: c.dotColor || '#94a3b8' }}
                      />
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-line bg-white p-4">
              <h2 className="mb-2 text-sm font-bold text-ink">{t('kb.latest')}</h2>
              <PostMiniList items={data.latest} emptyLabel={t('kb.empty')} />
            </section>

            <section className="rounded-xl border border-line bg-white p-4">
              <h2 className="mb-2 text-sm font-bold text-ink">{t('kb.popular')}</h2>
              <PostMiniList items={data.popular} emptyLabel={t('kb.empty')} showViews />
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

/** 공지 블록 — 편집 모드에서 인라인 추가/삭제. FR-KB-005 */
function NoticeSection({ notices, editMode }: { notices: KbDashboardBlock[]; editMode: boolean }) {
  const { t } = useTranslation('hscode');
  const createBlock = useCreateKbBlock();
  const delBlock = useDeleteKbBlock();
  const [title, setTitle] = useState('');
  const [flag, setFlag] = useState('');

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createBlock.mutate(
      {
        dsb_block_type: 'NOTICE',
        dsb_title: title.trim(),
        dsb_flag_label: flag.trim() || undefined,
        dsb_sort_order: notices.length,
      },
      {
        onSuccess: () => {
          setTitle('');
          setFlag('');
        },
      },
    );
  };

  return (
    <section className="rounded-xl border border-line bg-white p-4">
      <h2 className="mb-2 text-sm font-bold text-ink">📢 {t('kb.notice')}</h2>
      {notices.length === 0 && !editMode && <p className="text-xs text-muted">{t('kb.empty')}</p>}
      <ul className="space-y-1.5">
        {notices.map((n) => (
          <li key={n.dsbId} className="flex items-center gap-2 text-sm text-ink">
            {n.flagLabel && (
              <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[11px] font-bold text-brand">
                {n.flagLabel}
              </span>
            )}
            <span className="flex-1">{n.title}</span>
            {editMode && (
              <button onClick={() => delBlock.mutate(n.dsbId)} className="text-muted hover:text-bad">
                <X size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {editMode && (
        <form onSubmit={onAdd} className="mt-3 flex items-center gap-2 border-t border-line pt-3">
          <input
            value={flag}
            onChange={(e) => setFlag(e.target.value)}
            placeholder={t('kb.flagLabel')}
            className="w-28 rounded border border-line2 px-2 py-1.5 text-xs outline-none focus:border-brand"
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('kb.addNotice')}
            className="flex-1 rounded border border-line2 px-2 py-1.5 text-sm outline-none focus:border-brand"
          />
          <button
            type="submit"
            disabled={createBlock.isPending}
            className="flex items-center gap-1 rounded bg-brand px-2.5 py-1.5 text-xs font-bold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            <Plus size={13} /> {t('kb.add')}
          </button>
        </form>
      )}
    </section>
  );
}

/** 주요 팁 블록 — 편집 모드에서 카드 드래그 정렬(네이티브 DnD) + 추가/삭제. FR-KB-006 */
function TipsSection({ tips, editMode }: { tips: KbDashboardBlock[]; editMode: boolean }) {
  const { t } = useTranslation('hscode');
  const createBlock = useCreateKbBlock();
  const delBlock = useDeleteKbBlock();
  const reorder = useReorderKbBlocks();

  const [order, setOrder] = useState<KbDashboardBlock[]>(tips);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [flag, setFlag] = useState('');

  useEffect(() => setOrder(tips), [tips]);

  const onDrop = (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) return;
    const next = [...order];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(targetIdx, 0, moved);
    setOrder(next);
    setDragIdx(null);
    reorder.mutate(next.map((b, i) => ({ dsb_id: b.dsbId, dsb_sort_order: i })));
  };

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createBlock.mutate(
      {
        dsb_block_type: 'TIP',
        dsb_title: title.trim(),
        dsb_body: body.trim() || undefined,
        dsb_flag_label: flag.trim() || undefined,
        dsb_sort_order: order.length,
      },
      {
        onSuccess: () => {
          setTitle('');
          setBody('');
          setFlag('');
        },
      },
    );
  };

  return (
    <section className="rounded-xl border border-line bg-white p-4">
      <h2 className="mb-2 text-sm font-bold text-ink">
        💡 {t('kb.tips')}
        {editMode && <span className="ml-2 text-[11px] font-normal text-muted">{t('kb.dragHint')}</span>}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {order.map((tip, idx) => (
          <div
            key={tip.dsbId}
            draggable={editMode}
            onDragStart={() => setDragIdx(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(idx)}
            className={
              'relative rounded-lg border border-line2 bg-gray-50 p-3' +
              (editMode ? ' cursor-move' : '')
            }
          >
            {editMode && (
              <div className="mb-1 flex items-center justify-between text-muted">
                <GripVertical size={14} />
                <button onClick={() => delBlock.mutate(tip.dsbId)} className="hover:text-bad">
                  <X size={14} />
                </button>
              </div>
            )}
            {tip.flagLabel && (
              <span className="mb-1 inline-block rounded bg-ok/10 px-1.5 py-0.5 text-[11px] font-bold text-ok">
                {tip.flagLabel}
              </span>
            )}
            <p className="text-sm font-semibold text-ink">{tip.title}</p>
            {tip.body && <p className="mt-1 text-xs text-muted">{tip.body}</p>}
          </div>
        ))}
        {order.length === 0 && !editMode && <p className="text-xs text-muted">{t('kb.empty')}</p>}
      </div>
      {editMode && (
        <form onSubmit={onAdd} className="mt-3 space-y-2 border-t border-line pt-3">
          <div className="flex gap-2">
            <input
              value={flag}
              onChange={(e) => setFlag(e.target.value)}
              placeholder={t('kb.flagLabel')}
              className="w-28 rounded border border-line2 px-2 py-1.5 text-xs outline-none focus:border-brand"
            />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('kb.tipTitle')}
              className="flex-1 rounded border border-line2 px-2 py-1.5 text-sm outline-none focus:border-brand"
            />
          </div>
          <div className="flex gap-2">
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t('kb.tipBody')}
              className="flex-1 rounded border border-line2 px-2 py-1.5 text-sm outline-none focus:border-brand"
            />
            <button
              type="submit"
              disabled={createBlock.isPending}
              className="flex items-center gap-1 rounded bg-brand px-2.5 py-1.5 text-xs font-bold text-white hover:bg-brand-dark disabled:opacity-50"
            >
              <Plus size={13} /> {t('kb.add')}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function PostMiniList({
  items,
  emptyLabel,
  showViews,
}: {
  items: { pstId: string; title: string; viewCount: number; isPinned: boolean }[];
  emptyLabel: string;
  showViews?: boolean;
}) {
  if (items.length === 0) return <p className="text-xs text-muted">{emptyLabel}</p>;
  return (
    <ol className="space-y-1.5">
      {items.map((p) => (
        <li key={p.pstId}>
          <Link
            to={`/knowledge-base/posts/${p.pstId}`}
            className="flex items-center justify-between gap-2 text-sm text-ink hover:text-brand"
          >
            <span className="flex items-center gap-1 truncate">
              {p.isPinned && <Pin size={12} className="shrink-0 text-brand" />}
              <span className="truncate">{p.title}</span>
            </span>
            {showViews && (
              <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-muted">
                <Eye size={11} /> {p.viewCount}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ol>
  );
}
