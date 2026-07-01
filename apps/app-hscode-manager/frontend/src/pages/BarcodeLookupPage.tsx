import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ScreenHeader from '@/components/common/ScreenHeader';
import ConfidenceBadge from '@/components/common/ConfidenceBadge';
import LegalNotice from '@/components/common/LegalNotice';
import PipelineLayers from '@/components/barcode/PipelineLayers';
import { useGtinResolve } from '@/hooks/useGtin';

const COUNTRIES = [
  { code: 'VN', key: 'bc.vn' },
  { code: 'KR', key: 'bc.kr' },
  { code: 'US', key: 'bc.us' },
];

export default function BarcodeLookupPage() {
  const { t } = useTranslation('hscode');
  const resolve = useGtinResolve();
  const [gtin, setGtin] = useState('');
  const [country, setCountry] = useState('VN');

  const onResolve = () => {
    if (!gtin.trim()) return;
    resolve.mutate({ gtin: gtin.trim(), country });
  };

  const data = resolve.data;
  const invalid = resolve.isError;

  return (
    <section>
      <ScreenHeader id="SCR-002" title={t('bc.title')} sub={t('bc.sub')} />

      {/* 입력 바 */}
      <div className="mt-4 rounded-xl border border-line bg-white p-5">
        <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1.5fr_1fr_auto]">
          <label className="block text-xs font-bold text-muted">
            {t('bc.gtin')} *
            <input
              value={gtin}
              onChange={(e) => setGtin(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onResolve()}
              placeholder="8 806 311 234 567"
              className="fld-input tabular-nums tracking-wider"
            />
            <span className="mt-1.5 block text-xs font-normal text-muted2">{t('bc.gtinhint')}</span>
          </label>
          <label className="block text-xs font-bold text-muted">
            {t('bc.country')} *
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="fld-input"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {t(c.key)}
                </option>
              ))}
            </select>
            <span className="mt-1.5 block text-xs font-normal text-muted2">{t('bc.countryhint')}</span>
          </label>
          <button
            onClick={onResolve}
            disabled={!gtin.trim() || resolve.isPending}
            className="rounded-s bg-brand px-[18px] py-2.5 text-[13.5px] font-semibold text-white hover:bg-brand-dark disabled:opacity-45"
          >
            {t('bc.resolve')}
          </button>
        </div>
        {invalid && (
          <p className="mt-3 text-[12.5px] font-semibold text-bad">{t('bc.gtinhint')}</p>
        )}
      </div>

      {data && (
        <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-2">
          {/* 해석 결과 */}
          <div className="mt-4 rounded-xl border border-line bg-white p-5">
            <h3 className="mb-3.5 text-[14.5px] font-semibold">{t('bc.result')}</h3>
            <div className="rounded-[10px] border border-line bg-gradient-to-b from-white to-[#fafbff] p-[18px]">
              {data.status === 'RESOLVED' ? (
                <>
                  <div className="flex flex-wrap items-center gap-3 tabular-nums">
                    <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand-dark">
                      HS6 {data.hs6}
                    </span>
                    <span className="text-muted2">→</span>
                    <span className="text-[26px] font-extrabold">
                      {data.hsCode ?? data.hs6}
                    </span>
                    <span className="rounded-md bg-[#f3f4f6] px-2 py-0.5 text-[11px] font-bold text-muted">
                      {data.country}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-[130px_1fr] gap-y-2 text-[13px]">
                    {data.description && (
                      <>
                        <span className="font-semibold text-muted">{t('k.name')}</span>
                        <span className="font-semibold">{data.description}</span>
                      </>
                    )}
                    {data.dutyRate != null && (
                      <>
                        <span className="font-semibold text-muted">{t('k.duty')}</span>
                        <span className="font-semibold">{data.dutyRate}%</span>
                      </>
                    )}
                    <span className="font-semibold text-muted">{t('k.source')}</span>
                    <span className="font-semibold">
                      <span className="rounded-md bg-ok-soft px-2 py-0.5 text-[11px] font-bold text-ok">
                        {data.source}
                      </span>
                    </span>
                    {data.confidence != null && (
                      <>
                        <span className="font-semibold text-muted">{t('k.conf')}</span>
                        <span>
                          <ConfidenceBadge score={data.confidence} />
                        </span>
                      </>
                    )}
                  </div>
                  {!data.countryDigitsAvailable && (
                    <p className="mt-3 text-[12.5px] text-[#92520B]">{t('bc.nodigits')}</p>
                  )}
                </>
              ) : (
                <p className="text-[13px] text-muted">{t('bc.notfound')}</p>
              )}
              <LegalNotice />
            </div>
          </div>

          {/* 파이프라인 */}
          <div className="mt-4 rounded-xl border border-line bg-white p-5">
            <h3 className="mb-3.5 text-[14.5px] font-semibold">{t('bc.pipeline')}</h3>
            <PipelineLayers layers={data.layers} />
          </div>
        </div>
      )}
    </section>
  );
}
