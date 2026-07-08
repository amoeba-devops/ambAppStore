import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ScreenHeader from '@/components/common/ScreenHeader';
import SubTabs from '@/components/common/SubTabs';
import { referenceService } from '@/services/reference.service';
import {
  useApproveReview,
  useImports,
  useReviewQueue,
  useUploadImport,
} from '@/hooks/useAdmin';
import type { CountryExtension } from '@/types/admin.types';

export default function ReferencePage() {
  const { t } = useTranslation('hscode');
  const [tab, setTab] = useState('import');

  return (
    <section>
      <ScreenHeader id="SCR-005" title={t('ad.title')} sub={t('ad.sub')} />
      <SubTabs
        tabs={[
          { key: 'import', label: t('ad.tab.import') },
          { key: 'review', label: t('ad.tab.review') },
          { key: 'map', label: t('ad.tab.map') },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'import' && <ImportPane />}
      {tab === 'review' && <ReviewPane />}
      {tab === 'map' && <MappingPane />}
    </section>
  );
}

function ImportPane() {
  const { t } = useTranslation('hscode');
  const { data } = useImports();
  const upload = useUploadImport();
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <div className="mt-4 rounded-xl border border-line bg-white p-5">
      <h3 className="mb-3.5 text-[14.5px] font-semibold">{t('ad.import')}</h3>
      <input
        ref={fileInput}
        type="file"
        accept=".xls,.xlsx"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload.mutate({ file: f });
        }}
      />
      <div
        onClick={() => fileInput.current?.click()}
        className="cursor-pointer rounded-[11px] border-2 border-dashed border-line2 bg-[#fbfcff] px-4 py-7 text-center text-muted hover:border-brand hover:bg-brand-soft"
      >
        <div className="mb-1 text-[15px] font-bold text-ink">{t('ad.dropbig')}</div>
        <b className="text-brand-dark">{t('at.choose')}</b>
      </div>

      <table className="mt-4 w-full border-collapse text-[13px]">
        <thead>
          <tr className="text-[11.5px] uppercase tracking-wide text-muted">
            <th className="border-b border-line p-2.5 text-left">{t('th.file')}</th>
            <th className="border-b border-line p-2.5 text-left">{t('th.adapter')}</th>
            <th className="border-b border-line p-2.5 text-left">{t('th.total')}</th>
            <th className="border-b border-line p-2.5 text-left">{t('th.imported')}</th>
            <th className="border-b border-line p-2.5 text-left">{t('th.failed')}</th>
          </tr>
        </thead>
        <tbody>
          {data?.items.map((b) => (
            <tr key={b.id}>
              <td className="border-b border-line p-2.5">{b.fileName}</td>
              <td className="border-b border-line p-2.5">
                <span className="rounded-md border border-line bg-[#f3f4f6] px-2 py-0.5 text-[11px] font-bold text-muted">
                  {b.formatType}
                </span>
              </td>
              <td className="border-b border-line p-2.5 tabular-nums">{b.rowsTotal}</td>
              <td className="border-b border-line p-2.5 tabular-nums">{b.rowsImported}</td>
              <td className="border-b border-line p-2.5 tabular-nums">{b.rowsFailed}</td>
            </tr>
          ))}
          {!data?.items.length && (
            <tr>
              <td colSpan={5} className="p-4 text-center text-muted">
                —
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ReviewPane() {
  const { t } = useTranslation('hscode');
  const { data } = useReviewQueue();
  const approve = useApproveReview();

  return (
    <div className="mt-4 rounded-xl border border-line bg-white p-5">
      <h3 className="mb-3.5 text-[14.5px] font-semibold">{t('ad.queue')}</h3>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="text-[11.5px] uppercase tracking-wide text-muted">
            <th className="border-b border-line p-2.5 text-left">{t('bc.gtin')}</th>
            <th className="border-b border-line p-2.5 text-left">{t('th.status')}</th>
            <th className="border-b border-line p-2.5 text-left">{t('th.action')}</th>
          </tr>
        </thead>
        <tbody>
          {data?.items.map((item) => (
            <tr key={item.id}>
              <td className="border-b border-line p-2.5 tabular-nums">{item.gtin ?? '—'}</td>
              <td className="border-b border-line p-2.5">{item.status}</td>
              <td className="border-b border-line p-2.5">
                <button
                  onClick={() => {
                    const hs = window.prompt('HS code (e.g. 4016.93.00)');
                    if (hs) approve.mutate({ id: item.id, hsCode: hs, hs6: hs.replace(/\D/g, '').slice(0, 6) });
                  }}
                  className="rounded-s bg-brand px-3 py-1 text-[12.5px] font-semibold text-white hover:bg-brand-dark"
                >
                  {t('ad.approve')}
                </button>
              </td>
            </tr>
          ))}
          {!data?.items.length && (
            <tr>
              <td colSpan={3} className="p-4 text-center text-muted">
                —
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function MappingPane() {
  const { t } = useTranslation('hscode');
  const [hs6, setHs6] = useState('');
  const [country, setCountry] = useState('VN');
  const [hsFull, setHsFull] = useState('');
  const [duty, setDuty] = useState('');
  const [preview, setPreview] = useState<CountryExtension[]>([]);

  const onSave = async () => {
    if (!hs6 || !hsFull) return;
    await referenceService.upsertCountryExt({
      hs6,
      country,
      hs_full: hsFull,
      duty_rate: duty ? Number(duty) : undefined,
    });
    setPreview(await referenceService.preview(hs6));
  };

  const onPreview = async () => {
    if (hs6) setPreview(await referenceService.preview(hs6));
  };

  return (
    <div className="mt-4 grid grid-cols-1 gap-[18px] lg:grid-cols-2">
      <div className="rounded-xl border border-line bg-white p-5">
        <h3 className="mb-3.5 text-[14.5px] font-semibold">{t('ad.mapedit')}</h3>
        <label className="mb-3 block text-xs font-bold text-muted">
          HS6
          <input value={hs6} onChange={(e) => setHs6(e.target.value)} className="fld-input" placeholder="4016.93" />
        </label>
        <div className="flex gap-2.5">
          <label className="mb-3 block flex-1 text-xs font-bold text-muted">
            {t('th.country')}
            <select value={country} onChange={(e) => setCountry(e.target.value)} className="fld-input">
              <option>VN</option>
              <option>KR</option>
              <option>US</option>
            </select>
          </label>
          <label className="mb-3 block flex-1 text-xs font-bold text-muted">
            {t('th.fullcode')}
            <input value={hsFull} onChange={(e) => setHsFull(e.target.value)} className="fld-input" placeholder="4016.93.00" />
          </label>
        </div>
        <label className="mb-3 block text-xs font-bold text-muted">
          {t('th.dutyc')} (%)
          <input value={duty} onChange={(e) => setDuty(e.target.value)} className="fld-input" type="number" />
        </label>
        <div className="flex justify-end gap-2">
          <button onClick={onPreview} className="rounded-s border border-line2 bg-white px-3 py-1.5 text-[12.5px] font-semibold hover:border-brand-light">
            {t('ad.preview')}
          </button>
          <button onClick={onSave} className="rounded-s bg-brand px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-brand-dark">
            {t('ad.save')}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white p-5">
        <h3 className="mb-3.5 text-[13px] font-semibold">{t('ad.preview')}</h3>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-[11.5px] uppercase tracking-wide text-muted">
              <th className="border-b border-line p-2.5 text-left">{t('th.country')}</th>
              <th className="border-b border-line p-2.5 text-left">{t('th.fullcode')}</th>
              <th className="border-b border-line p-2.5 text-left">{t('th.dutyc')}</th>
            </tr>
          </thead>
          <tbody>
            {preview.map((e) => (
              <tr key={e.hceId}>
                <td className="border-b border-line p-2.5">{e.country}</td>
                <td className="border-b border-line p-2.5 tabular-nums">{e.hsFull}</td>
                <td className="border-b border-line p-2.5">{e.dutyRate ?? '—'}%</td>
              </tr>
            ))}
            {!preview.length && (
              <tr>
                <td colSpan={3} className="p-4 text-center text-muted">
                  —
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
