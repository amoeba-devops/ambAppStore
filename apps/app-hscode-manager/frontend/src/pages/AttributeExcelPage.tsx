import { ReactNode, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import ScreenHeader from '@/components/common/ScreenHeader';
import ConfidenceBadge from '@/components/common/ConfidenceBadge';
import { excelService } from '@/services/excel.service';
import {
  useAttributeClassify,
  useExcelClassify,
  useExcelJob,
  useSaveReference,
} from '@/hooks/useAttributeExcel';
import type { Candidate } from '@/types/hscode.types';
import type { RowValidationError } from '@/types/excel.types';

const ORIGINS = ['R.KOREA', 'CHINA', 'VIETNAM'];
const UNITS = ['METRES', 'PIECES', 'SETS', 'ROLL'];

export default function AttributeExcelPage() {
  const { t } = useTranslation('hscode');

  // --- 속성 폼 ---
  const classify = useAttributeClassify();
  const [form, setForm] = useState({
    name: '',
    material: '',
    usage: '',
    origin: ORIGINS[0],
    unit: UNITS[0],
    processing: 'finished',
  });
  const [attrCandidates, setAttrCandidates] = useState<Candidate[]>([]);

  // 확정 결과 → reference 저장 (FR-005 자기개선 루프)
  const saveRef = useSaveReference();
  const [savedIdx, setSavedIdx] = useState<Record<number, 'saved' | 'dup'>>({});

  const onClassify = async () => {
    if (form.name.trim().length < 2) return;
    const res = await classify.mutateAsync(form);
    setAttrCandidates(res.candidates);
    setSavedIdx({});
  };

  const onSaveRef = async (c: Candidate, i: number) => {
    const r = await saveRef.mutateAsync({
      hs_code: c.hsCode,
      description: c.description,
      origin: c.origin ?? undefined,
      unit: c.unit ?? undefined,
    });
    setSavedIdx((prev) => ({ ...prev, [i]: r.imported > 0 ? 'saved' : 'dup' }));
  };

  // --- 엑셀 ---
  const enqueue = useExcelClassify();
  const [jobId, setJobId] = useState<string | null>(null);
  const [errors, setErrors] = useState<RowValidationError[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const { data: job } = useExcelJob(jobId);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const res = await enqueue.mutateAsync(file);
    setErrors(res.errors);
    setJobId(res.jobId);
  };

  return (
    <section>
      <ScreenHeader id="SCR-003" title={t('at.title')} sub={t('at.sub')} />

      <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-2">
        {/* 속성 폼 */}
        <div className="mt-4 rounded-xl border border-line bg-white p-5">
          <h3 className="mb-3.5 text-[14.5px] font-semibold">{t('at.form')}</h3>

          <Field label={`${t('k.name')} *`}>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('at.ph.name')}
              className="fld-input"
            />
          </Field>
          <div className="flex gap-2.5">
            <Field label={t('k.material')} className="flex-1">
              <input
                value={form.material}
                onChange={(e) => setForm({ ...form, material: e.target.value })}
                placeholder={t('at.ph.material')}
                className="fld-input"
              />
            </Field>
            <Field label={t('k.usage')} className="flex-1">
              <input
                value={form.usage}
                onChange={(e) => setForm({ ...form, usage: e.target.value })}
                placeholder={t('at.ph.usage')}
                className="fld-input"
              />
            </Field>
          </div>
          <div className="flex gap-2.5">
            <Field label={t('k.origin')} className="flex-1">
              <select
                value={form.origin}
                onChange={(e) => setForm({ ...form, origin: e.target.value })}
                className="fld-input"
              >
                {ORIGINS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Field>
            <Field label={t('k.unit')} className="flex-1">
              <select
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="fld-input"
              >
                {UNITS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label={t('at.proc')}>
            <div className="mt-2 flex flex-wrap gap-4 text-[13px]">
              {(['finished', 'semi', 'raw'] as const).map((p) => (
                <label key={p} className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="radio"
                    name="proc"
                    checked={form.processing === p}
                    onChange={() => setForm({ ...form, processing: p })}
                  />
                  {t(`at.${p}`)}
                </label>
              ))}
            </div>
          </Field>

          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={onClassify}
              disabled={form.name.trim().length < 2 || classify.isPending}
              className="rounded-s bg-brand px-[18px] py-2.5 text-[13.5px] font-semibold text-white hover:bg-brand-dark disabled:opacity-45"
            >
              {t('at.classify')}
            </button>
          </div>

          {attrCandidates.length > 0 && (
            <div className="mt-3.5 flex flex-col gap-2.5">
              {attrCandidates.map((c, i) => (
                <div
                  key={i}
                  className={clsx(
                    'rounded-[10px] border bg-white p-3.5',
                    i === 0 ? 'border-brand' : 'border-line',
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-[15px] font-extrabold tabular-nums">{c.hsCode}</span>
                    <span className="min-w-[130px] flex-1 font-semibold">{c.description}</span>
                    <ConfidenceBadge score={c.score} />
                  </div>
                  {c.rationale && (
                    <div className="mt-1.5 text-[12px] text-muted">
                      <span className="font-semibold">{t('k.reason')}:</span> {c.rationale}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2 border-t border-dashed border-line pt-2">
                    <button
                      onClick={() => void onSaveRef(c, i)}
                      disabled={saveRef.isPending || !!savedIdx[i]}
                      className="rounded-s border border-line2 bg-white px-2.5 py-1 text-[12px] font-semibold hover:border-brand-light disabled:opacity-45"
                    >
                      {t('at.saveref')}
                    </button>
                    {savedIdx[i] === 'saved' && (
                      <span className="text-[12px] font-semibold text-emerald-600">{t('at.saved')}</span>
                    )}
                    {savedIdx[i] === 'dup' && (
                      <span className="text-[12px] text-muted">{t('at.savedup')}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 엑셀 */}
        <div className="mt-4 rounded-xl border border-line bg-white p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
            <h3 className="text-[14.5px] font-semibold">{t('at.excel')}</h3>
            <button
              onClick={() => void excelService.downloadTemplate()}
              className="rounded-s border border-line2 bg-white px-3 py-1.5 text-[12.5px] font-semibold hover:border-brand-light"
            >
              {t('at.template')}
            </button>
          </div>

          <input
            ref={fileInput}
            type="file"
            accept=".xls,.xlsx"
            hidden
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <div
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void onFile(e.dataTransfer.files?.[0]);
            }}
            className="cursor-pointer rounded-[11px] border-2 border-dashed border-line2 bg-[#fbfcff] px-4 py-7 text-center text-muted hover:border-brand hover:bg-brand-soft"
          >
            <div className="mb-1 text-[15px] font-bold text-ink">{t('at.dropbig')}</div>
            <b className="text-brand-dark">{t('at.choose')}</b>{' '}
            <span>{t('at.ordrop')}</span>
          </div>

          {errors.length > 0 && (
            <div className="mt-3 rounded-[9px] border border-[#FCD9A3] bg-warn-soft px-3.5 py-3 text-[12.5px] text-[#92520B]">
              <b>{t('at.valtitle')}</b>
              {errors.map((e, i) => (
                <div key={i} className="py-0.5">
                  · {e.row}: [{e.col}] {e.reason}
                </div>
              ))}
            </div>
          )}

          {job && (
            <div className="mt-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2.5">
                <span className="text-[13px] font-bold">
                  {t('at.results')} · {job.results?.length ?? 0}
                  {job.total != null ? ` / ${job.total}` : ''}
                </span>
                {job.status === 'completed' && (
                  <button
                    onClick={() => void excelService.downloadResult(job.jobId)}
                    className="rounded-s bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-brand-dark"
                  >
                    {t('at.download')}
                  </button>
                )}
              </div>
              <div className="h-2 overflow-hidden rounded-md bg-[#f3f4f6]">
                <div
                  className="h-full rounded-md bg-gradient-to-r from-brand-light to-brand transition-all"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
              <div className="mb-2.5 mt-1 text-xs text-muted2">
                {t('at.queue')} · {job.progress}% ({job.status})
              </div>

              {job.results && job.results.length > 0 && (
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="text-[11.5px] uppercase tracking-wide text-muted">
                      <th className="border-b border-line p-2.5 text-left">{t('th.row')}</th>
                      <th className="border-b border-line p-2.5 text-left">{t('k.name')}</th>
                      <th className="border-b border-line p-2.5 text-left">{t('th.hs')}</th>
                      <th className="border-b border-line p-2.5 text-left">{t('k.conf')}</th>
                      <th className="border-b border-line p-2.5 text-left">{t('th.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {job.results.map((r) => (
                      <tr key={r.rowNo}>
                        <td className="border-b border-line p-2.5 tabular-nums font-bold">{r.rowNo}</td>
                        <td className="border-b border-line p-2.5">{r.name}</td>
                        <td className="border-b border-line p-2.5 tabular-nums">{r.hsCode}</td>
                        <td className="border-b border-line p-2.5">
                          <ConfidenceBadge score={r.confidence} />
                        </td>
                        <td className="border-b border-line p-2.5">
                          {r.status === 'AUTO' ? (
                            <span className="rounded-md bg-ok-soft px-2 py-0.5 text-[11px] font-bold text-ok">
                              {t('at.auto')}
                            </span>
                          ) : (
                            <span className="text-[11.5px] font-bold text-warn">{t('at.manual')}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="mt-1.5 text-xs text-muted2">{t('at.flaghint')}</div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={clsx('mb-3 block text-xs font-bold text-muted', className)}>
      {label}
      {children}
    </label>
  );
}
