import { useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useMatchUpload, useMatchRequests } from '@/hooks/useMatching';

/** SCR-1 — 홈 = 문서 업로드 매칭 (주 기능). 드래그&드롭 즉시 분석, 최소 단계. */
export default function MatchUploadPage() {
  const { t } = useTranslation('hscode');
  const navigate = useNavigate();
  const upload = useMatchUpload();
  const { data: recent } = useMatchRequests(1, 5);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    upload.mutate(file, {
      onSuccess: (detail) => navigate(`/match/${detail.request.mrqId}`),
    });
  };

  return (
    <div className="py-8">
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-ink">{t('m.title')}</h1>
      <p className="mb-6 text-sm text-muted">{t('m.subtitle')}</p>

      {/* 드롭존 */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={clsx(
          'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-16 text-center transition',
          dragging ? 'border-brand bg-brand-soft' : 'border-line2 bg-white hover:border-brand hover:bg-brand-soft/40',
          upload.isPending && 'pointer-events-none opacity-60',
        )}
      >
        <div className="text-5xl">{upload.isPending ? '⏳' : '📄'}</div>
        <div className="text-base font-bold text-ink">
          {upload.isPending ? t('m.analyzing') : t('m.dropHere')}
        </div>
        <div className="text-sm text-muted">{t('m.formats')}</div>
        <button
          type="button"
          className="mt-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-dark"
        >
          {t('m.selectFile')}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {upload.isError && (
        <p className="mt-3 text-sm font-semibold text-bad">{t('m.uploadError')}</p>
      )}

      {/* 고급(수동 입력) — 부가 기능, 별도 버튼 */}
      <div className="mt-4 flex items-center justify-between">
        <Link to="/search/attribute" className="text-sm font-semibold text-muted hover:text-brand">
          + {t('m.advancedManual')}
        </Link>
        <Link to="/history" className="text-sm font-semibold text-muted hover:text-brand">
          {t('m.viewHistory')} →
        </Link>
      </div>

      {/* 최근 업로드 */}
      {recent && recent.items.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-bold text-muted">{t('m.recent')}</h2>
          <div className="divide-y divide-line rounded-xl border border-line bg-white">
            {recent.items.map((r) => (
              <button
                key={r.mrqId}
                onClick={() => navigate(`/match/${r.mrqId}`)}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-brand-soft/40"
              >
                <span className="truncate text-sm font-semibold text-ink">
                  {r.fileName ?? r.mrqId}
                </span>
                <span className="ml-3 shrink-0 text-xs text-muted">
                  {t('m.itemsN', { n: r.itemCount })} · {statusLabel(r.status, t)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function statusLabel(status: string, t: (k: string) => string): string {
  return t(`m.status.${status}`) || status;
}
