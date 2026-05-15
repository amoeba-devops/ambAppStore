'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@v2/ui';
import type { ProductMetric } from '@/lib/weekly-report-mock';

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

export function WeeklyProductBreakdownTable({ products, krwRate }: Props) {
  const [search, setSearch] = useState('');
  const [currency, setCurrency] = useState<Currency>('VND');
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
    const totalGmv = sum('gmv');
    return {
      pv: sum('pv'),
      items: sum('items'),
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
        <h2 className="text-base font-semibold text-neutral-900">Product Breakdown</h2>
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
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SKU or product…"
              className="w-56 rounded-md border border-neutral-300 bg-white py-1.5 pl-8 pr-3 text-sm placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none"
            />
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1600px] text-sm">
          <thead className="bg-neutral-50 text-[11px] uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium">No</th>
              <th className="px-3 py-2.5 text-left font-medium">SKU</th>
              <th className="px-3 py-2.5 text-left font-medium">Product (VI)</th>
              <th className="px-3 py-2.5 text-left font-medium">Product (EN)</th>
              <th className="px-3 py-2.5 text-left font-medium">Platform</th>
              <th className="px-3 py-2.5 text-right font-medium">PV</th>
              <th className="px-3 py-2.5 text-right font-medium">CVR%</th>
              <th className="px-3 py-2.5 text-right font-medium">Items</th>
              <th className="px-3 py-2.5 text-right font-medium">GMV</th>
              <th className="px-3 py-2.5 text-right font-medium">Net GMV</th>
              <th className="px-3 py-2.5 text-right font-medium">NMV</th>
              <th className="px-3 py-2.5 text-right font-medium">Voucher</th>
              <th className="px-3 py-2.5 text-right font-medium">Seller Disc</th>
              <th className="px-3 py-2.5 text-right font-medium">Free Gift</th>
              <th className="px-3 py-2.5 text-right font-medium">AD Spend</th>
              <th className="px-3 py-2.5 text-right font-medium">Brand Ads</th>
              <th className="px-3 py-2.5 text-right font-medium">Off-Platform Ads</th>
              <th className="px-3 py-2.5 text-right font-medium">Aff.Comm</th>
              <th className="px-3 py-2.5 text-right font-medium">Aff.Book</th>
              <th className="px-3 py-2.5 text-right font-medium">Livestream</th>
              <th className="px-3 py-2.5 text-right font-medium">Platform Fee</th>
              <th className="px-3 py-2.5 text-right font-medium">Prime Cost</th>
              <th className="px-3 py-2.5 text-right font-medium">CM</th>
              <th className="px-3 py-2.5 text-right font-medium">CM%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={24} className="px-5 py-8 text-center text-sm text-neutral-500">
                  No products match.
                </td>
              </tr>
            )}
            {filtered.length > 0 && (
              <tr className="bg-neutral-50 border-b-2 border-neutral-300 font-semibold">
                <td className="px-3 py-3 text-neutral-900" colSpan={5}>TOTAL</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(totals.pv)}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-400">—</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(totals.items)}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(conv(totals.gmv))}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(conv(totals.netGmv))}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(conv(totals.nmv))}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(conv(totals.voucher))}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(conv(totals.sellerDisc))}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(conv(totals.freeGift))}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(conv(totals.adSpend))}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(conv(totals.brandAds))}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(conv(totals.offPlatformAds))}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(conv(totals.affComm))}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(conv(totals.affBook))}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(conv(totals.livestream))}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(conv(totals.platformFee))}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(conv(totals.primeCost))}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums text-success-500">{fmtN(conv(totals.cm))}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums text-success-500">
                  {totals.netGmv === 0 ? '—' : fmtPct(totals.cm / totals.netGmv, 2)}
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const cmPct = p.netGmv === 0 ? 0 : p.cm / p.netGmv;
              return (
                <tr key={p.sku} className="hover:bg-neutral-50/60">
                  <td className="px-3 py-3 font-mono text-xs text-neutral-500">{p.no}</td>
                  <td className="px-3 py-3">
                    <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-700">{p.sku}</code>
                  </td>
                  <td className="px-3 py-3 text-neutral-900 whitespace-nowrap max-w-[180px] truncate">{p.nameVi}</td>
                  <td className="px-3 py-3 text-neutral-700 whitespace-nowrap max-w-[180px] truncate">{p.nameEn}</td>
                  <td className="px-3 py-3">
                    <PlatformPill platform={p.platform} />
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-700">{fmtN(p.pv)}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-700">{fmtPct(p.cvr)}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-700">{fmtN(p.items)}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-900">{fmtN(conv(p.gmv))}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-900 font-semibold">{fmtN(conv(p.netGmv))}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-700">{fmtN(conv(p.nmv))}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-700">{fmtN(conv(p.voucher))}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-700">{fmtN(conv(p.sellerDisc))}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-700">{fmtN(conv(p.freeGift))}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-700">{fmtN(conv(p.adSpend))}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-700">{fmtN(conv(p.brandAds))}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-700">{fmtN(conv(p.offPlatformAds))}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-700">{fmtN(conv(p.affComm))}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-700">{fmtN(conv(p.affBook))}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-700">{fmtN(conv(p.livestream))}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-700">{fmtN(conv(p.platformFee))}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-700">{fmtN(conv(p.primeCost))}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-success-500 font-semibold">{fmtN(conv(p.cm))}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-success-500">{fmtPct(cmPct, 2)}</td>
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
