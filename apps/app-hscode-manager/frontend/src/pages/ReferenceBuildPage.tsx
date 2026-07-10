import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useImportHsCodes,
  useKnowledgeDocuments,
  useUploadDeclaration,
} from '@/hooks/useKnowledge';

const SYSTEMS = ['VN', 'KR', 'CN', 'US'] as const;

/** SCR-4 — 레퍼런스(RAG) 구축. 면장 + HS 기준표(VN/KR/CN/US) + 지식 업로드 → RAG 축적. */
export default function ReferenceBuildPage() {
  const { t } = useTranslation('hscode');
  const { data: docs } = useKnowledgeDocuments();
  const declUpload = useUploadDeclaration();
  const hsImport = useImportHsCodes();
  const [system, setSystem] = useState<string>('VN');
  const declRef = useRef<HTMLInputElement>(null);
  const hsRef = useRef<HTMLInputElement>(null);

  return (
    <div className="py-6">
      <h1 className="mb-1 text-xl font-extrabold text-ink">{t('rb.title')}</h1>
      <p className="mb-6 text-sm text-muted">{t('rb.subtitle')}</p>

      <div className="grid gap-4 md:grid-cols-2">
        {/* 면장 업로드 */}
        <section className="rounded-xl border border-line bg-white p-4">
          <h2 className="mb-1 text-sm font-bold text-ink">📋 {t('rb.declTitle')}</h2>
          <p className="mb-3 text-xs text-muted">{t('rb.declDesc')}</p>
          <button
            onClick={() => declRef.current?.click()}
            disabled={declUpload.isPending}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {declUpload.isPending ? t('common.uploading') : t('rb.uploadDecl')}
          </button>
          <input
            ref={declRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) declUpload.mutate({ file: f });
            }}
          />
          {declUpload.isSuccess &&
            (declUpload.data.rowsImported > 0 ? (
              <p className="mt-2 text-xs font-semibold text-ok">
                ✓ {t('rb.declDone', { n: declUpload.data.rowsImported })}
                {declUpload.data.rowsFailed > 0 && (
                  <span className="text-muted"> · {t('rb.declSkip', { n: declUpload.data.rowsFailed })}</span>
                )}
              </p>
            ) : (
              <p className="mt-2 text-xs font-semibold text-warn">
                ⚠ {t('rb.declNone')}
              </p>
            ))}
          {declUpload.isError && <p className="mt-2 text-xs font-semibold text-bad">{t('rb.failed')}</p>}
        </section>

        {/* HS 기준표 업로드 */}
        <section className="rounded-xl border border-line bg-white p-4">
          <h2 className="mb-1 text-sm font-bold text-ink">📚 {t('rb.hsTitle')}</h2>
          <p className="mb-3 text-xs text-muted">{t('rb.hsDesc')}</p>
          <div className="flex items-center gap-2">
            <select
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              className="rounded-lg border border-line2 px-2 py-2 text-sm outline-none focus:border-brand"
            >
              {SYSTEMS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              onClick={() => hsRef.current?.click()}
              disabled={hsImport.isPending}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {hsImport.isPending ? t('common.uploading') : t('rb.uploadHs')}
            </button>
          </div>
          <input
            ref={hsRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) hsImport.mutate({ file: f, system });
            }}
          />
          {hsImport.isSuccess && (
            <p className="mt-2 text-xs font-semibold text-ok">
              ✓ {t('rb.hsDone', { imported: hsImport.data.imported, skipped: hsImport.data.skipped })}
            </p>
          )}
          {hsImport.isError && <p className="mt-2 text-xs font-semibold text-bad">{t('rb.failed')}</p>}
        </section>
      </div>

      {/* 지식 현황 */}
      <div className="mt-6">
        <h2 className="mb-2 text-sm font-bold text-muted">{t('rb.status')}</h2>
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-line/20 text-left text-xs text-muted">
                <th className="px-4 py-2 font-semibold">{t('rb.colTitle')}</th>
                <th className="px-3 py-2 font-semibold">{t('rb.colType')}</th>
                <th className="px-3 py-2 font-semibold">{t('rb.colScope')}</th>
                <th className="px-3 py-2 text-right font-semibold">{t('rb.colChunks')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(docs ?? []).map((d) => (
                <tr key={d.docId}>
                  <td className="px-4 py-2 font-semibold text-ink">{d.title}</td>
                  <td className="px-3 py-2 text-muted">{d.docType}</td>
                  <td className="px-3 py-2 text-muted">{d.scope}</td>
                  <td className="px-3 py-2 text-right text-muted">
                    {d.embeddedCount}/{d.chunkCount}
                  </td>
                </tr>
              ))}
              {(!docs || docs.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted">
                    {t('rb.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
