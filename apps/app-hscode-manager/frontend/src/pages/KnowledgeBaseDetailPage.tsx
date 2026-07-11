import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Download, Eye, Languages, Pin, Trash2, Upload } from 'lucide-react';
import { knowledgeBaseService } from '@/services/knowledge-base.service';
import {
  useDeleteKbPost,
  useKbPost,
  useKbTranslate,
  usePromoteToRag,
} from '@/hooks/useKnowledgeBase';
import { useAuthStore } from '@/stores/auth.store';
import type { KbPostTranslation } from '@/types/knowledge-base.types';

const LANGS = ['ko', 'en', 'vi', 'id'] as const;

/** SCR-KB-03 — 게시글 상세. 본문 + 번역박스 + 첨부 + 관련글 + RAG승격. FR-KB-002/009/014 */
export default function KnowledgeBaseDetailPage() {
  const { t } = useTranslation('hscode');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin());

  const { data: post, isLoading } = useKbPost(id);
  const translate = useKbTranslate(id ?? '');
  const promote = usePromoteToRag();
  const del = useDeleteKbPost();

  const [targetLang, setTargetLang] = useState<string>('en');
  const [translation, setTranslation] = useState<KbPostTranslation | null>(null);

  if (isLoading) return <p className="py-6 text-sm text-muted">{t('common.loading')}</p>;
  if (!post) return <p className="py-6 text-sm text-muted">{t('kb.notFound')}</p>;

  const onTranslate = () => {
    translate.mutate(targetLang, { onSuccess: (r) => setTranslation(r) });
  };

  const onPromote = () => {
    if (!id) return;
    promote.mutate(id);
  };

  const onDelete = () => {
    if (!id || !window.confirm(t('kb.confirmDelete'))) return;
    del.mutate(id, { onSuccess: () => navigate('/knowledge-base/posts') });
  };

  const onDownload = async (attId: string, fileName: string) => {
    if (!id) return;
    const blob = await knowledgeBaseService.downloadAttachment(id, attId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="py-6">
      <Link to="/knowledge-base/posts" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> {t('kb.backToList')}
      </Link>

      <div className="rounded-xl border border-line bg-white p-5">
        <div className="mb-2 flex items-start justify-between gap-3">
          <h1 className="flex items-center gap-2 text-xl font-extrabold text-ink">
            {post.isPinned && <Pin size={16} className="text-brand" />}
            {post.title}
          </h1>
          {isSuperAdmin && (
            <div className="flex shrink-0 gap-2">
              <Link
                to={`/knowledge-base/posts/${post.pstId}/edit`}
                className="rounded-lg border border-line2 px-2.5 py-1 text-xs font-bold text-muted hover:text-ink"
              >
                🔒 {t('kb.edit')}
              </Link>
              <button
                onClick={onDelete}
                className="flex items-center gap-1 rounded-lg border border-bad/30 px-2.5 py-1 text-xs font-bold text-bad hover:bg-bad/5"
              >
                <Trash2 size={13} /> {t('kb.delete')}
              </button>
            </div>
          )}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-muted">
          {post.categoryName && <span>{post.categoryName}</span>}
          <span>
            {t('kb.sourceLang')}: {post.sourceLang.toUpperCase()}
          </span>
          {post.tags.map((tag) => (
            <span key={tag.tagId}>#{tag.name}</span>
          ))}
          <span className="flex items-center gap-0.5">
            <Eye size={12} /> {post.viewCount}
          </span>
          <span>{new Date(post.createdAt).toLocaleDateString()}</span>
        </div>

        {/* 번역 박스 */}
        <div className="mb-4 rounded-lg border border-line2 bg-gray-50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Languages size={15} className="text-brand" />
            <span className="text-xs font-bold text-ink">{t('kb.translation')}</span>
            <span className="text-xs text-muted">
              {t('kb.original')}: {post.sourceLang.toUpperCase()} →
            </span>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="rounded border border-line2 px-2 py-1 text-xs"
            >
              {LANGS.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </select>
            <button
              onClick={onTranslate}
              disabled={translate.isPending}
              className="rounded bg-brand px-2.5 py-1 text-xs font-bold text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {translate.isPending ? t('common.loading') : t('kb.translate')}
            </button>
          </div>
          {translation && (
            <div className="mt-3 border-t border-line2 pt-3">
              <p className="mb-1 text-sm font-bold text-ink">{translation.translatedTitle}</p>
              <p className="whitespace-pre-wrap text-sm text-ink">{translation.translatedContent}</p>
              <p className="mt-1 text-[11px] text-muted">
                {translation.source === 'MANUAL' ? t('kb.manualTrans') : t('kb.aiTrans')}
              </p>
            </div>
          )}
        </div>

        {/* 본문 */}
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{post.content}</div>

        {/* 첨부 */}
        {post.attachments.length > 0 && (
          <div className="mt-5 border-t border-line pt-3">
            <h3 className="mb-2 text-xs font-bold text-muted">📎 {t('kb.attachments')}</h3>
            <ul className="space-y-1">
              {post.attachments.map((a) => (
                <li key={a.attId}>
                  <button
                    onClick={() => onDownload(a.attId, a.fileName)}
                    className="flex items-center gap-1.5 text-sm text-brand hover:underline"
                  >
                    <Download size={13} /> {a.fileName}
                    <span className="text-[11px] text-muted">
                      ({(a.fileSize / 1024 / 1024).toFixed(1)}MB)
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* RAG 승격 (슈퍼관리자) */}
        {isSuperAdmin && (
          <div className="mt-5 border-t border-line pt-3">
            {post.isPromotedToRag ? (
              <p className="text-xs font-semibold text-ok">
                ✔ {t('kb.promoted')} ({post.promotedDocId})
              </p>
            ) : (
              <button
                onClick={onPromote}
                disabled={promote.isPending}
                className="flex items-center gap-1.5 rounded-lg border border-brand/40 px-3 py-1.5 text-sm font-bold text-brand hover:bg-brand/5 disabled:opacity-50"
              >
                <Upload size={14} /> {promote.isPending ? t('common.loading') : t('kb.promoteToRag')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 관련 글 */}
      {post.related.length > 0 && (
        <div className="mt-4 rounded-xl border border-line bg-white p-4">
          <h3 className="mb-2 text-sm font-bold text-ink">{t('kb.related')}</h3>
          <ul className="space-y-1">
            {post.related.map((r) => (
              <li key={r.pstId}>
                <Link to={`/knowledge-base/posts/${r.pstId}`} className="text-sm text-ink hover:text-brand">
                  · {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
