'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@v2/ui';
import type { ProductMetric } from '@/lib/weekly-report-mock';
import { formatSkuMultiline } from '@/lib/sku-format';

interface Props {
  products: ProductMetric[];
  krwRate: number;
}

type Currency = 'VND' | 'KRW';

function fmtN(n: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(n));
}

function fmtPct(n: number, decimals = 1): string {
  return (n * 100).toFixed(decimals) + '%';
}

// formatSkuMultiline moved to @/lib/sku-format (shared util)

/**
 * Columns whose values come from platform-level totals allocated/distributed
 * per product (not exact per-product data). Highlighted yellow so the operator
 * knows these are estimates from a share key, not authoritative.
 */
const ALLOC = 'bg-warning-50/40';

/**
 * Columns derived from other columns (e.g. CM, CM%). Highlighted green so the
 * operator knows these are computed, not from source data.
 */
const CALC = 'bg-success-50/40';

export function WeeklyProductBreakdownTable({ products, krwRate }: Props) {
  const t = useTranslations('weeklyReport.productBreakdown');
  const [search, setSearch] = useState('');
  const [currency, setCurrency] = useState<Currency>('VND');
  const [productLang, setProductLang] = useState<'vi' | 'en'>('vi');
  // Refs for syncing top ruler + main table horizontal scroll (so admin can
  // scroll horizontally without first scrolling to the bottom of the table).
  const topScrollRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [tableWidth, setTableWidth] = useState(0);
  const syncingRef = useRef<'top' | 'main' | null>(null);

  // Measure inner table width on mount + when products change.
  useEffect(() => {
    const measure = () => {
      const w = tableRef.current?.scrollWidth ?? 0;
      if (w > 0) setTableWidth(w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (tableRef.current) ro.observe(tableRef.current);
    return () => ro.disconnect();
  }, [products]);

  const onTopScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (syncingRef.current === 'main') return;
    syncingRef.current = 'top';
    if (mainScrollRef.current) mainScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    requestAnimationFrame(() => {
      syncingRef.current = null;
    });
  };
  const onMainScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (syncingRef.current === 'top') return;
    syncingRef.current = 'main';
    if (topScrollRef.current) topScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    requestAnimationFrame(() => {
      syncingRef.current = null;
    });
  };
  const safeRate = krwRate > 0 ? krwRate : 1;
  const conv = (vnd: number) => (currency === 'VND' ? vnd : vnd / safeRate);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.sku.toLowerCase().includes(q) ||
        p.nameVi.toLowerCase().includes(q) ||
        p.nameEn.toLowerCase().includes(q),
    );
  }, [products, search]);

  const totals = useMemo(() => {
    const sum = (k: keyof ProductMetric) =>
      filtered.reduce((a, b) => a + (typeof b[k] === 'number' ? (b[k] as number) : 0), 0);
    // Items column excludes gift rows (revenue-generating items only).
    // Free Gift column sums only gift rows' Prime Cost (gift cost separated).
    const sumExcludingGifts = (k: keyof ProductMetric) =>
      filtered.reduce(
        (a, b) => a + (!b.isGift && typeof b[k] === 'number' ? (b[k] as number) : 0),
        0,
      );
    const totalGmv = sum('gmv');
    return {
      pv: sum('pv'),
      items: sumExcludingGifts('items'),
      gmv: totalGmv,
      netGmv: sum('netGmv'),
      nmv: sum('nmv'),
      voucher: sum('voucher'),
      sellerDisc: sum('sellerDisc'),
      freeGift: sum('freeGift'),
      adSpend: sum('adSpend'),
      brandAds: sum('brandAds'),
      offPlatformAds: sum('offPlatformAds'),
      affComm: sum('affComm'),
      affBook: sum('affBook'),
      livestream: sum('livestream'),
      platformFee: sum('platformFee'),
      primeCost: sum('primeCost'),
      cm: sum('cm'),
    };
  }, [filtered]);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4 gap-3">
        <div className="flex items-center gap-4">
          <h2 className="text-base font-semibold text-neutral-900">{t('title')}</h2>
          <div className="flex items-center gap-3 text-[11px] text-neutral-500">
            <span className="inline-flex items-center gap-1.5">
              <span className={cn('inline-block h-3 w-3 rounded-sm border border-neutral-200', ALLOC)} />
              {t('legend.allocated')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className={cn('inline-block h-3 w-3 rounded-sm border border-neutral-200', CALC)} />
              {t('legend.calculated')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-neutral-300 bg-white p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setCurrency('VND')}
              className={cn(
                'rounded px-3 py-1 font-medium transition-colors',
                currency === 'VND'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-700 hover:bg-neutral-50',
              )}
            >
              VND ₫
            </button>
            <button
              type="button"
              onClick={() => setCurrency('KRW')}
              className={cn(
                'rounded px-3 py-1 font-medium transition-colors',
                currency === 'KRW'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-700 hover:bg-neutral-50',
              )}
            >
              KRW ₩
            </button>
          </div>
          <div className="inline-flex rounded-md border border-neutral-300 bg-white p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setProductLang('vi')}
              className={cn(
                'rounded px-3 py-1 font-medium transition-colors',
                productLang === 'vi'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-700 hover:bg-neutral-50',
              )}
            >
              VI
            </button>
            <button
              type="button"
              onClick={() => setProductLang('en')}
              className={cn(
                'rounded px-3 py-1 font-medium transition-colors',
                productLang === 'en'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-700 hover:bg-neutral-50',
              )}
            >
              EN
            </button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-56 rounded-md border border-neutral-300 bg-white py-1.5 pl-8 pr-3 text-sm placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none"
            />
          </div>
        </div>
      </div>
      {/* Top horizontal scrollbar — mirrors the main table's horizontal scroll
          so admin doesn't have to scroll to the bottom of a tall table first. */}
      <div
        ref={topScrollRef}
        onScroll={onTopScroll}
        className="overflow-x-auto overflow-y-hidden border-b border-neutral-100"
        aria-hidden="true"
      >
        <div style={{ width: tableWidth, height: 1 }} />
      </div>
      <div ref={mainScrollRef} onScroll={onMainScroll} className="overflow-auto max-h-[80vh]">
        <table ref={tableRef} className="w-full min-w-[1600px] text-sm">
          <thead className="bg-neutral-50 text-[11px] uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="sticky left-0 top-0 z-40 w-12 bg-neutral-50 px-3 py-2.5 text-left font-medium">{t('col.no')}</th>
              <th className="sticky left-12 top-0 z-40 w-28 bg-neutral-50 px-3 py-2.5 text-left font-medium">{t('col.sku')}</th>
              <th className={cn(
                'sticky top-0 z-40 left-[10rem] w-44 border-r border-neutral-200 bg-neutral-50 px-3 py-2.5 text-left font-medium',
                productLang === 'vi' ? 'table-cell' : 'hidden',
              )}>{t('col.productVi')}</th>
              <th className={cn(
                'sticky top-0 z-40 left-[10rem] w-44 border-r border-neutral-200 bg-neutral-50 px-3 py-2.5 text-left font-medium',
                productLang === 'en' ? 'table-cell' : 'hidden',
              )}>{t('col.productEn')}</th>
              <th className="sticky top-0 z-30 bg-neutral-50 px-3 py-2.5 text-left font-medium">{t('col.platform')}</th>
              <th className="sticky top-0 z-30 bg-neutral-50 px-3 py-2.5 text-right font-medium">{t('col.pv')}</th>
              <th className="sticky top-0 z-30 bg-neutral-50 px-3 py-2.5 text-right font-medium">{t('col.cvr')}</th>
              <th className="sticky top-0 z-30 bg-neutral-50 px-3 py-2.5 text-right font-medium">{t('col.items')}</th>
              <th className="sticky top-0 z-30 bg-neutral-50 px-3 py-2.5 text-right font-medium">{t('col.gmv')}</th>
              <th className="sticky top-0 z-30 bg-neutral-50 px-3 py-2.5 text-right font-medium">{t('col.netGmv')}</th>
              <th className="sticky top-0 z-30 bg-neutral-50 px-3 py-2.5 text-right font-medium">{t('col.nmv')}</th>
              <th className="sticky top-0 z-30 bg-warning-50 px-3 py-2.5 text-right font-medium">{t('col.voucher')}</th>
              <th className="sticky top-0 z-30 bg-neutral-50 px-3 py-2.5 text-right font-medium">{t('col.sellerDisc')}</th>
              <th className="sticky top-0 z-30 bg-warning-50 px-3 py-2.5 text-right font-medium">{t('col.freeGift')}</th>
              <th className="sticky top-0 z-30 bg-warning-50 px-3 py-2.5 text-right font-medium">{t('col.adSpend')}</th>
              <th className="sticky top-0 z-30 bg-warning-50 px-3 py-2.5 text-right font-medium">{t('col.brandAds')}</th>
              <th className="sticky top-0 z-30 bg-warning-50 px-3 py-2.5 text-right font-medium">{t('col.offPlatformAds')}</th>
              <th className="sticky top-0 z-30 bg-warning-50 px-3 py-2.5 text-right font-medium">{t('col.affComm')}</th>
              <th className="sticky top-0 z-30 bg-warning-50 px-3 py-2.5 text-right font-medium">{t('col.affBook')}</th>
              <th className="sticky top-0 z-30 bg-warning-50 px-3 py-2.5 text-right font-medium">{t('col.livestream')}</th>
              <th className="sticky top-0 z-30 bg-warning-50 px-3 py-2.5 text-right font-medium">{t('col.platformFee')}</th>
              <th className="sticky top-0 z-30 bg-neutral-50 px-3 py-2.5 text-right font-medium">{t('col.primeCost')}</th>
              <th className="sticky top-0 right-20 z-40 w-32 bg-success-50 border-l border-neutral-200 px-3 py-2.5 text-right font-medium">{t('col.cm')}</th>
              <th className="sticky top-0 right-0 z-40 w-20 bg-success-50 px-3 py-2.5 text-right font-medium">{t('col.cmPct')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={24} className="px-5 py-8 text-center text-sm text-neutral-500">
                  {t('empty')}
                </td>
              </tr>
            )}
            {filtered.length > 0 && (
              <tr className="font-semibold">
                <td className="sticky left-0 top-[37px] z-30 w-12 bg-neutral-100 border-b-2 border-neutral-300 px-3 py-3 text-neutral-900">{t('total')}</td>
                <td className="sticky left-12 top-[37px] z-30 w-28 bg-neutral-100 border-b-2 border-neutral-300 px-3 py-3"></td>
                <td className={cn(
                  'sticky left-[10rem] top-[37px] z-30 w-44 border-r border-neutral-200 bg-neutral-100 border-b-2 border-b-neutral-300 px-3 py-3',
                  productLang === 'vi' ? 'table-cell' : 'hidden',
                )}></td>
                <td className={cn(
                  'sticky left-[10rem] top-[37px] z-30 w-44 border-r border-neutral-200 bg-neutral-100 border-b-2 border-b-neutral-300 px-3 py-3',
                  productLang === 'en' ? 'table-cell' : 'hidden',
                )}></td>
                <td className="sticky top-[37px] z-20 bg-neutral-100 border-b-2 border-neutral-300 px-3 py-3"></td>
                <td className="sticky top-[37px] z-20 bg-neutral-100 border-b-2 border-neutral-300 px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(totals.pv)}</td>
                <td className="sticky top-[37px] z-20 bg-neutral-100 border-b-2 border-neutral-300 px-3 py-3 text-right font-mono tabular-nums text-neutral-900">
                  {totals.pv > 0 ? fmtPct(totals.items / totals.pv) : '—'}
                </td>
                <td className="sticky top-[37px] z-20 bg-neutral-100 border-b-2 border-neutral-300 px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(totals.items)}</td>
                <td className="sticky top-[37px] z-20 bg-neutral-100 border-b-2 border-neutral-300 px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(conv(totals.gmv))}</td>
                <td className="sticky top-[37px] z-20 bg-neutral-100 border-b-2 border-neutral-300 px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(conv(totals.netGmv))}</td>
                <td className="sticky top-[37px] z-20 bg-neutral-100 border-b-2 border-neutral-300 px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(conv(totals.nmv))}</td>
                <td className="sticky top-[37px] z-20 bg-warning-50 border-b-2 border-neutral-300 px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(conv(totals.voucher))}</td>
                <td className="sticky top-[37px] z-20 bg-neutral-100 border-b-2 border-neutral-300 px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(conv(totals.sellerDisc))}</td>
                <td className="sticky top-[37px] z-20 bg-warning-50 border-b-2 border-neutral-300 px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(conv(totals.freeGift))}</td>
                <td className="sticky top-[37px] z-20 bg-warning-50 border-b-2 border-neutral-300 px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(conv(totals.adSpend))}</td>
                <td className="sticky top-[37px] z-20 bg-warning-50 border-b-2 border-neutral-300 px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(conv(totals.brandAds))}</td>
                <td className="sticky top-[37px] z-20 bg-warning-50 border-b-2 border-neutral-300 px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(conv(totals.offPlatformAds))}</td>
                <td className="sticky top-[37px] z-20 bg-warning-50 border-b-2 border-neutral-300 px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(conv(totals.affComm))}</td>
                <td className="sticky top-[37px] z-20 bg-warning-50 border-b-2 border-neutral-300 px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(conv(totals.affBook))}</td>
                <td className="sticky top-[37px] z-20 bg-warning-50 border-b-2 border-neutral-300 px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(conv(totals.livestream))}</td>
                <td className="sticky top-[37px] z-20 bg-warning-50 border-b-2 border-neutral-300 px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(conv(totals.platformFee))}</td>
                <td className="sticky top-[37px] z-20 bg-neutral-100 border-b-2 border-neutral-300 px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(conv(totals.primeCost))}</td>
                <td className="sticky top-[37px] right-20 z-30 w-32 bg-success-50 border-l border-b-2 border-neutral-300 border-l-neutral-200 px-3 py-3 text-right font-mono tabular-nums text-success-500">{fmtN(conv(totals.cm))}</td>
                <td className="sticky top-[37px] right-0 z-30 w-20 bg-success-50 border-b-2 border-neutral-300 px-3 py-3 text-right font-mono tabular-nums text-success-500">
                  {totals.netGmv === 0 ? '—' : fmtPct(totals.cm / totals.netGmv, 2)}
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const cmPct = p.netGmv === 0 ? 0 : p.cm / p.netGmv;
              return (
                <tr
                  key={`${p.platform}::${p.sku}::${p.nameVi}::${p.isGift ? 'g' : p.isOthers ? 'o' : p.isShopWideAd ? 'sw' : 's'}`}
                  className={cn(
                    'group',
                    p.isGift
                      ? 'bg-warning-50 hover:bg-warning-50/80'
                      : p.isOthers
                        ? 'bg-neutral-100 italic text-neutral-600 hover:bg-neutral-100/80 border-t-2 border-neutral-300'
                        : p.isShopWideAd
                          ? 'bg-info-50/50 hover:bg-info-50'
                          : 'hover:bg-neutral-50/60',
                  )}
                >
                  <td className={cn(
                    'sticky left-0 z-10 w-12 px-3 py-3 font-mono text-xs text-neutral-500',
                    p.isGift
                      ? 'bg-warning-50 group-hover:bg-warning-100'
                      : p.isOthers
                        ? 'bg-neutral-100 group-hover:bg-neutral-200'
                        : p.isShopWideAd
                          ? 'bg-info-50/50 group-hover:bg-info-50'
                          : 'bg-white group-hover:bg-neutral-50',
                  )}>{p.no}</td>
                  <td className={cn(
                    'sticky left-12 z-10 w-28 px-3 py-3',
                    p.isGift
                      ? 'bg-warning-50 group-hover:bg-warning-100'
                      : p.isOthers
                        ? 'bg-neutral-100 group-hover:bg-neutral-200'
                        : p.isShopWideAd
                          ? 'bg-info-50/50 group-hover:bg-info-50'
                          : 'bg-white group-hover:bg-neutral-50',
                  )}>
                    <code className="inline-block rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-700 whitespace-pre-line leading-tight">
                      {formatSkuMultiline(p.sku)}
                    </code>
                  </td>
                  <td className={cn(
                    'sticky left-[10rem] z-10 w-44 border-r border-neutral-200 px-3 py-3 text-neutral-900 whitespace-nowrap truncate',
                    productLang === 'vi' ? 'table-cell' : 'hidden',
                    p.isGift
                      ? 'bg-warning-50 group-hover:bg-warning-100'
                      : p.isOthers
                        ? 'bg-neutral-100 group-hover:bg-neutral-200'
                        : p.isShopWideAd
                          ? 'bg-info-50/50 group-hover:bg-info-50'
                          : 'bg-white group-hover:bg-neutral-50',
                  )}>
                    {p.nameVi}
                    {p.variationName && (
                      <span className="ml-1.5 text-[11px] font-normal text-neutral-500 align-middle">
                        · {p.variationName}
                      </span>
                    )}
                    {p.isCombo && (
                      <span className="ml-1.5 inline-flex items-center rounded-full bg-warning-50 px-1.5 py-0.5 text-[10px] font-medium text-warning-500 align-middle">
                        {t('comboBadge')}
                      </span>
                    )}
                  </td>
                  <td className={cn(
                    'sticky left-[10rem] z-10 w-44 border-r border-neutral-200 px-3 py-3 text-neutral-700 whitespace-nowrap truncate',
                    productLang === 'en' ? 'table-cell' : 'hidden',
                    p.isGift
                      ? 'bg-warning-50 group-hover:bg-warning-100'
                      : p.isOthers
                        ? 'bg-neutral-100 group-hover:bg-neutral-200'
                        : p.isShopWideAd
                          ? 'bg-info-50/50 group-hover:bg-info-50'
                          : 'bg-white group-hover:bg-neutral-50',
                  )}>
                    {p.nameEn}
                    {p.variationName && (
                      <span className="ml-1.5 text-[11px] font-normal text-neutral-500 align-middle">
                        · {p.variationName}
                      </span>
                    )}
                    {p.isCombo && (
                      <span className="ml-1.5 inline-flex items-center rounded-full bg-warning-50 px-1.5 py-0.5 text-[10px] font-medium text-warning-500 align-middle">
                        {t('comboBadge')}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <PlatformPill platform={p.platform} />
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-700">
                    {p.isShopWideAd || p.pv === 0 ? '—' : fmtN(p.pv)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-700">
                    {p.isGift || p.isShopWideAd || p.cvr === 0 ? '—' : fmtPct(p.cvr)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-700">{p.isShopWideAd ? '—' : fmtN(p.items)}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{p.isGift || p.isShopWideAd ? '—' : fmtN(conv(p.gmv))}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-900 font-semibold">{p.isGift || p.isShopWideAd ? '—' : fmtN(conv(p.netGmv))}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-700">{p.isGift || p.isShopWideAd ? '—' : fmtN(conv(p.nmv))}</td>
                  <td className={cn('px-3 py-3 text-right font-mono tabular-nums text-neutral-700', !p.isGift && !p.isShopWideAd && ALLOC)}>{p.isGift || p.isShopWideAd ? '—' : fmtN(conv(p.voucher))}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-700">{p.isGift || p.isShopWideAd ? '—' : fmtN(conv(p.sellerDisc))}</td>
                  <td className={cn('px-3 py-3 text-right font-mono tabular-nums text-neutral-700', !p.isGift && !p.isShopWideAd && ALLOC)}>{p.isGift || p.isShopWideAd ? '—' : fmtN(conv(p.freeGift))}</td>
                  <td className={cn('px-3 py-3 text-right font-mono tabular-nums text-neutral-700', !p.isGift && ALLOC)}>{p.isGift ? '—' : fmtN(conv(p.adSpend))}</td>
                  <td className={cn('px-3 py-3 text-right font-mono tabular-nums text-neutral-700', !p.isGift && !p.isShopWideAd && ALLOC)}>{p.isGift || p.isShopWideAd ? '—' : fmtN(conv(p.brandAds))}</td>
                  <td className={cn('px-3 py-3 text-right font-mono tabular-nums text-neutral-700', !p.isGift && !p.isShopWideAd && ALLOC)}>{p.isGift || p.isShopWideAd ? '—' : fmtN(conv(p.offPlatformAds))}</td>
                  <td className={cn('px-3 py-3 text-right font-mono tabular-nums text-neutral-700', !p.isGift && !p.isShopWideAd && ALLOC)}>{p.isGift || p.isShopWideAd ? '—' : fmtN(conv(p.affComm))}</td>
                  <td className={cn('px-3 py-3 text-right font-mono tabular-nums text-neutral-700', !p.isGift && !p.isShopWideAd && ALLOC)}>{p.isGift || p.isShopWideAd ? '—' : fmtN(conv(p.affBook))}</td>
                  <td className={cn('px-3 py-3 text-right font-mono tabular-nums text-neutral-700', !p.isGift && !p.isShopWideAd && ALLOC)}>{p.isGift || p.isShopWideAd ? '—' : fmtN(conv(p.livestream))}</td>
                  <td className={cn('px-3 py-3 text-right font-mono tabular-nums text-neutral-700', !p.isGift && !p.isShopWideAd && ALLOC)}>{p.isGift || p.isShopWideAd ? '—' : fmtN(conv(p.platformFee))}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-700">{p.isShopWideAd ? '—' : fmtN(conv(p.primeCost))}</td>
                  <td
                    className={cn(
                      'sticky right-20 z-10 w-32 border-l border-neutral-200 px-3 py-3 text-right font-mono tabular-nums text-success-500 font-semibold',
                      p.isGift
                        ? 'bg-warning-50 group-hover:bg-warning-100'
                        : p.isOthers
                          ? 'bg-neutral-100 italic text-neutral-500 font-normal group-hover:bg-neutral-200'
                          : p.isShopWideAd
                            ? 'bg-info-50/60 text-neutral-500 font-normal group-hover:bg-info-50'
                            : 'bg-success-50 group-hover:bg-success-100',
                    )}
                  >
                    {p.isGift || p.isShopWideAd ? '—' : fmtN(conv(p.cm))}
                  </td>
                  <td
                    className={cn(
                      'sticky right-0 z-10 w-20 px-3 py-3 text-right font-mono tabular-nums text-success-500',
                      p.isGift
                        ? 'bg-warning-50 group-hover:bg-warning-100'
                        : p.isOthers
                          ? 'bg-neutral-100 italic text-neutral-500 group-hover:bg-neutral-200'
                          : p.isShopWideAd
                            ? 'bg-info-50/60 text-neutral-500 group-hover:bg-info-50'
                            : 'bg-success-50 group-hover:bg-success-100',
                    )}
                  >
                    {p.isGift || p.isShopWideAd ? '—' : fmtPct(cmPct, 2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlatformPill({ platform }: { platform: 'SHOPEE' | 'TIKTOK' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        platform === 'SHOPEE' ? 'bg-info-50 text-info-500' : 'bg-accent-50 text-accent-700',
      )}
    >
      {platform === 'SHOPEE' ? 'Shopee' : 'TikTok'}
    </span>
  );
}
