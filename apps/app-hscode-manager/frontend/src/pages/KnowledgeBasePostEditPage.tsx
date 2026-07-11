import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Trash2, Upload } from 'lucide-react';
import {
  useCreateKbPost,
  useDeleteAttachment,
  useKbAttachments,
  useKbCategories,
  useKbPost,
  useUpdateKbPost,
  useUploadAttachment,
} from '@/hooks/useKnowledgeBase';

const LANGS = ['ko', 'en', 'vi', 'id'] as const;

/** SCR-KB-04 — 게시글 작성/수정. 단일 언어 작성. @SuperAdminOnly. FR-KB-003/008 */
export default function KnowledgeBasePostEditPage() {
  const { t } = useTranslation('hscode');
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();

  const { data: categories } = useKbCategories();
  const { data: existing } = useKbPost(id);
  const create = useCreateKbPost();
  const update = useUpdateKbPost(id ?? '');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sourceLang, setSourceLang] = useState('ko');
  const [categoryId, setCategoryId] = useState('');
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setContent(existing.content);
      setSourceLang(existing.sourceLang);
      setCategoryId(existing.categoryId ?? '');
      setIsPinned(existing.isPinned);
    }
  }, [existing]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      pst_title: title,
      pst_content: content,
      pst_source_lang: sourceLang,
      pst_category_id: categoryId || undefined,
      pst_is_pinned: isPinned,
    };
    if (isEdit) {
      update.mutate(payload, { onSuccess: () => navigate(`/knowledge-base/posts/${id}`) });
    } else {
      create.mutate(payload, { onSuccess: (r) => navigate(`/knowledge-base/posts/${r.pstId}`) });
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <div className="py-6">
      <h1 className="mb-4 text-xl font-extrabold text-ink">
        {isEdit ? t('kb.editPost') : t('kb.newPost')}
      </h1>

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-line bg-white p-5">
        <div>
          <label className="mb-1 block text-xs font-bold text-muted">{t('kb.fTitle')}</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={300}
            className="w-full rounded-lg border border-line2 px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold text-muted">{t('kb.fCategory')}</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-line2 px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {categories?.map((c) => (
                <option key={c.catId} value={c.catId}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-muted">{t('kb.fLang')}</label>
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              className="w-full rounded-lg border border-line2 px-3 py-2 text-sm"
            >
              {LANGS.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} />
          {t('kb.fPin')}
        </label>

        <div>
          <label className="mb-1 block text-xs font-bold text-muted">{t('kb.fContent')}</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={14}
            className="w-full rounded-lg border border-line2 px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </div>

        {isEdit && id && <AttachmentSection postId={id} />}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-line2 px-4 py-2 text-sm font-bold text-muted hover:text-ink"
          >
            {t('kb.cancel')}
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {isPending ? t('common.loading') : t('kb.save')}
          </button>
        </div>
      </form>
    </div>
  );
}

const ACCEPT = '.pdf,.xlsx,.xls,.docx,.csv';

/** 첨부 관리 — 기존 게시글에서만(첨부는 postId 필요). ≤50MB. FR-KB-012 */
function AttachmentSection({ postId }: { postId: string }) {
  const { t } = useTranslation('hscode');
  const { data: attachments } = useKbAttachments(postId);
  const upload = useUploadAttachment(postId);
  const del = useDeleteAttachment(postId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState('');

  return (
    <div className="border-t border-line pt-4">
      <label className="mb-2 block text-xs font-bold text-muted">
        {t('kb.attachments')} ({ACCEPT}, ≤50MB)
      </label>
      <ul className="mb-2 space-y-1">
        {attachments?.map((a) => (
          <li key={a.attId} className="flex items-center gap-2 text-sm text-ink">
            <span className="flex-1">
              {a.fileName}{' '}
              <span className="text-[11px] text-muted">({(a.fileSize / 1024 / 1024).toFixed(1)}MB)</span>
            </span>
            <button
              type="button"
              onClick={() => del.mutate(a.attId)}
              className="text-muted hover:text-bad"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={upload.isPending}
        className="flex items-center gap-1 rounded-lg border border-line2 px-3 py-1.5 text-sm font-bold text-muted hover:text-ink disabled:opacity-50"
      >
        <Upload size={14} /> {upload.isPending ? t('common.uploading') : t('kb.uploadFile')}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setErr('');
          upload.mutate(f, { onError: (er) => setErr((er as Error).message) });
          e.target.value = '';
        }}
      />
      {err && <p className="mt-1 text-xs font-semibold text-bad">{err}</p>}
    </div>
  );
}
