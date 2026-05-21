'use client';

import { useState, useTransition } from 'react';
import {
  Calculator,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  Loader2,
  Gift,
  AlertTriangle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@v2/ui';
import { previewShopeeMetricsAction } from '@/server/actions/preview-calc.actions';
import type { ShopeeMetricsPreview } from '@/server/actions/preview-calc.actions';

interface Props {
  /** The Shopee Sales file currently selected in Step 2 (required). */
  file: File | null;
  /** Optional Shopee Ads CSV — enables Total Ad Spending. */
  adsFile?: File | null;
  /** Optional Shopee Brand Ads CSV — enables Total Brand Ads. */
  brandAdsFile?: File | null;
  /** Optional Shopee Off-Platform Ads CSV — enables Total Off-Platform Ads. */
  offPlatformAdsFile?: File | null;
  /** Optional Shopee Traffic xlsx — enables Total Page Views. */
  trafficFile?: File | null;
  /** Optional Shopee Affiliate CSV — enables Total Affiliate Commission. */
  affiliateFile?: File | null;
}

const fmtVnd = (n: number) =>
  n.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' VND';
const fmtCompact = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

export function TotalGmvPreviewCard({
  file,
  adsFile = null,
  brandAdsFile = null,
  offPlatformAdsFile = null,
  trafficFile = null,
  affiliateFile = null,
}: Props) {
  const t = useTranslations('uploadWizard.preview');
  void CheckCircle;
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<ShopeeMetricsPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const compute = () => {
    if (!file) return;
    setError(null);
    setPreview(null);
    const formData = new FormData();
    formData.append('sales', file);
    if (adsFile) formData.append('ads', adsFile);
    if (brandAdsFile) formData.append('brandAds', brandAdsFile);
    if (offPlatformAdsFile) formData.append('offPlatformAds', offPlatformAdsFile);
    if (trafficFile) formData.append('traffic', trafficFile);
    if (affiliateFile) formData.append('affiliate', affiliateFile);
    startTransition(async () => {
      const res = await previewShopeeMetricsAction(formData);
      if (!res.success) {
        setError(`${res.error.code}: ${res.error.message}`);
        return;
      }
      setPreview(res.data);
    });
  };

  const r = preview?.result;

  return (
    <div className="rounded-md border border-info-500/30 bg-info-50/30 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-info-500 text-white">
          <Calculator className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">{t('shopee.title')}</h3>
              <p className="text-xs text-neutral-500">{t('shopee.subtitle')}</p>
            </div>
            <button
              type="button"
              onClick={compute}
              disabled={!file || pending}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                !file || pending
                  ? 'cursor-not-allowed bg-neutral-200 text-neutral-400'
                  : 'bg-info-500 text-white hover:bg-info-500/90',
              )}
            >
              {pending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t('computing')}
                </>
              ) : (
                <>
                  <Calculator className="h-3 w-3" />
                  {preview ? t('recompute') : t('compute')}
                </>
              )}
            </button>
          </div>

          {!file && (
            <p className="mt-3 text-xs text-neutral-500">{t('shopee.uploadFirst')}</p>
          )}

          {error && (
            <div className="mt-3 flex items-start gap-1.5 rounded-md border border-error-500 bg-error-50 px-3 py-2 text-xs text-error-500">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {preview && r && (
            <div className="mt-4 space-y-3">
              {/* Revenue / cost metric cards — 5 base + 2 per-order */}
              <div>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  {t('section.revenueCost')}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  <MetricCard label="Total GMV" value={r.totalGmv} tone="primary" />
                  <MetricCard label="Total Net GMV" value={r.totalNetGmv} tone="info" />
                  <MetricCard label="Total NMV" value={r.totalNmv} tone="info" />
                  <MetricCard label="Total Seller Discount" value={r.totalSellerDiscount} tone="warn" />
                  <MetricCard
                    label="Total Prime Cost"
                    value={r.totalPrimeCost}
                    tone="error"
                    hint={`kept ${fmtCompact(r.primeCostKept)} + gift ${fmtCompact(r.primeCostFreeGift)}`}
                  />
                </div>
              </div>

              {/* Per-order metrics (Group A — dedupe by Order ID) */}
              <div>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  {t('section.perOrder')}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <MetricCard
                    label="Total Seller Vouchers"
                    value={r.totalSellerVouchers}
                    tone="warn"
                    hint={`across ${r.orderCounts.nonCancelled} non-cancelled orders`}
                  />
                  <MetricCard
                    label="Total Platform Fee"
                    value={r.totalPlatformFee}
                    tone="error"
                    hint={`fixed + service + payment fee per order`}
                  />
                </div>
              </div>

              {/* Ads + Affiliate (Groups B/C/D/F — only when CSV provided) */}
              {(r.ads || r.brandAds || r.offPlatformAds || r.affiliate) && (
                <div>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    {t('section.marketingCosts')}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {r.ads && (
                      <MetricCard
                        label="Total Ad Spending"
                        value={r.ads.totalCost}
                        tone="error"
                        hint={`${r.ads.campaignCount} campaigns · ${r.ads.productSpecificCount} products + shop-wide`}
                      />
                    )}
                    {r.brandAds && (
                      <MetricCard
                        label="Total Brand Ads"
                        value={r.brandAds.totalCost}
                        tone="error"
                        hint={`${r.brandAds.activeCampaignCount}/${r.brandAds.campaignCount} active campaigns`}
                      />
                    )}
                    {r.offPlatformAds && (
                      <MetricCard
                        label="Total Off-Platform Ads"
                        value={r.offPlatformAds.totalCost}
                        tone="error"
                        hint={`${r.offPlatformAds.dayCount} days · ${r.offPlatformAds.totalOrders} orders`}
                      />
                    )}
                    {r.affiliate && (
                      <MetricCard
                        label="Total Affiliate Commission"
                        value={r.affiliate.totalCost}
                        tone="error"
                        hint={`${r.affiliate.orderCount} orders · ${r.affiliate.rowCount} lines`}
                      />
                    )}
                  </div>
                </div>
              )}
              {!r.ads && adsFile === null && (
                <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
                  {t('hint.uploadShopeeAds')}
                </div>
              )}
              {!r.brandAds && brandAdsFile === null && (
                <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
                  {t('hint.uploadShopeeBrandAds')}
                </div>
              )}
              {!r.offPlatformAds && offPlatformAdsFile === null && (
                <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
                  {t('hint.uploadShopeeOffPlatform')}
                </div>
              )}

              {r.traffic && (
                <div>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    {t('section.traffic')}
                  </div>
                  <MetricCard
                    label="Total Page Views"
                    value={r.traffic.totalPageViews}
                    tone="info"
                    hint={`${r.traffic.productCount} products`}
                    unit="views"
                  />
                </div>
              )}
              {!r.traffic && trafficFile === null && (
                <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
                  {t('hint.uploadShopeeTraffic')}
                </div>
              )}
              {!r.affiliate && affiliateFile === null && (
                <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
                  {t('hint.uploadShopeeAffiliate')}
                </div>
              )}

              {/* Row + order breakdown stats */}
              <div className="grid grid-cols-5 gap-2 text-center">
                <Stat label={t('stat.rowsKept')} value={r.rowsKept} tone="ok" />
                <Stat label={t('stat.cancelled')} value={r.rowsExcluded.cancelled} tone="warn" />
                <Stat label={t('stat.returned')} value={r.rowsExcluded.returned} tone="warn" />
                <Stat
                  label={t('stat.freeGift')}
                  value={r.rowsExcluded.freeGift}
                  tone="info"
                  icon={<Gift className="h-2.5 w-2.5" />}
                />
                <Stat
                  label={t('stat.orders')}
                  value={r.orderCounts.nonCancelled}
                  tone="ok"
                  icon={null}
                />
              </div>

              {r.freeGiftProducts.length > 0 && (
                <details className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs">
                  <summary className="cursor-pointer font-medium text-neutral-700">
                    <Gift className="mr-1 inline h-3 w-3 text-info-500" />
                    {t('freeGiftDetected', { count: r.freeGiftProducts.length })}
                  </summary>
                  <ul className="mt-2 space-y-1 text-neutral-600">
                    {r.freeGiftProducts.map((p) => (
                      <li key={p} className="flex items-start gap-1.5">
                        <span className="mt-0.5 inline-block h-1 w-1 rounded-full bg-info-500 shrink-0" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {r.missingFromMaster.length > 0 && (
                <details className="rounded-md border border-warning-500/30 bg-warning-500/5 px-3 py-2 text-xs">
                  <summary className="cursor-pointer font-medium text-warning-500">
                    <AlertTriangle className="mr-1 inline h-3 w-3" />
                    {r.missingFromMaster.length === 1
                      ? t('missingFromMasterSingular')
                      : t('missingFromMaster', { count: r.missingFromMaster.length })}
                  </summary>
                  <ul className="mt-2 space-y-1 text-neutral-700">
                    {r.missingFromMaster.slice(0, 10).map((m) => (
                      <li key={m.sku} className="flex items-baseline gap-2">
                        <span className="font-mono text-[10px] text-warning-500">{m.sku}</span>
                        <span className="text-[10px] text-neutral-500">
                          ({m.units}u · {fmtCompact(m.gmvContribution)} VND)
                        </span>
                        <span className="line-clamp-1 flex-1 text-[11px]">{m.productName}</span>
                      </li>
                    ))}
                    {r.missingFromMaster.length > 10 && (
                      <li className="text-[10px] text-neutral-500">
                        {t('andMore', { count: r.missingFromMaster.length - 10 })}
                      </li>
                    )}
                  </ul>
                </details>
              )}

              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 text-[11px] font-medium text-neutral-600 hover:text-neutral-900"
              >
                <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} />
                {expanded ? t('hideFormulas') : t('showFormulas')}
              </button>

              {expanded && (
                <div className="space-y-3">
                  <FormulaSpecsBlock specs={preview.specs} />
                  <ProductBreakdownTable rows={r.productBreakdown} />
                </div>
              )}

              <div className="text-[10px] text-neutral-500">
                {t('loadedSkus', { count: preview.master.skuCount })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
  hint,
  unit = 'VND',
}: {
  label: string;
  value: number;
  tone: 'primary' | 'info' | 'warn' | 'error';
  hint?: string;
  /** Display unit — defaults to VND. Use "" or "views" for non-currency metrics. */
  unit?: string;
}) {
  const toneCls =
    tone === 'primary'
      ? 'border-success-500/30 bg-success-50/40'
      : tone === 'info'
        ? 'border-info-500/30 bg-info-50/40'
        : tone === 'warn'
          ? 'border-warning-500/30 bg-warning-500/5'
          : 'border-error-500/30 bg-error-50/40';
  const formatted =
    unit === 'VND'
      ? fmtVnd(value)
      : `${fmtCompact(value)}${unit ? ' ' + unit : ''}`;
  return (
    <div className={cn('rounded-md border px-3 py-2', toneCls)}>
      <div className="text-[9px] font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-sm font-semibold text-neutral-900">{formatted}</div>
      {hint && <div className="mt-0.5 text-[9px] text-neutral-500 font-mono">{hint}</div>}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: 'ok' | 'warn' | 'info';
  icon?: React.ReactNode;
}) {
  const toneCls =
    tone === 'ok'
      ? 'border-success-500/30 bg-success-50/40 text-success-500'
      : tone === 'warn'
        ? 'border-warning-500/30 bg-warning-500/5 text-warning-500'
        : 'border-info-500/30 bg-info-50/40 text-info-500';
  return (
    <div className={cn('rounded-md border px-2 py-1.5', toneCls)}>
      <div className="flex items-center justify-center gap-1 text-[9px] font-semibold uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 font-mono text-sm font-semibold text-neutral-900">{value}</div>
    </div>
  );
}

function FormulaSpecsBlock({ specs }: { specs: ShopeeMetricsPreview['specs'] }) {
  const t = useTranslations('uploadWizard.preview.formulaSpecs');
  const metricSpecs = [
    specs.TOTAL_GMV_SHOPEE,
    specs.TOTAL_NET_GMV_SHOPEE,
    specs.TOTAL_NMV_SHOPEE,
    specs.TOTAL_SELLER_DISCOUNT_SHOPEE,
    specs.TOTAL_PRIME_COST_SHOPEE,
    specs.TOTAL_SELLER_VOUCHERS_SHOPEE,
    specs.TOTAL_PLATFORM_FEE_SHOPEE,
    specs.TOTAL_AD_SPENDING_SHOPEE,
    specs.TOTAL_BRAND_ADS_SHOPEE,
    specs.TOTAL_OFF_PLATFORM_ADS_SHOPEE,
    specs.TOTAL_PAGE_VIEWS_SHOPEE,
    specs.TOTAL_AFFILIATE_COMMISSION_SHOPEE,
  ];
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
        {t('shopeeTitle')}
      </div>
      <div className="space-y-2 font-mono text-[11px] text-neutral-700">
        {metricSpecs.map((m) => (
          <div key={m.id} className="rounded bg-white px-2 py-1.5">
            <div className="font-sans text-[10px] font-semibold text-neutral-900">{m.name}</div>
            <div className="mt-0.5">{m.expression}</div>
            {'note' in m && m.note && (
              <div className="mt-0.5 text-[10px] font-sans italic text-neutral-500">{m.note}</div>
            )}
          </div>
        ))}
        <div className="rounded bg-white px-2 py-1.5">
          <div className="font-sans text-[10px] font-semibold text-neutral-900">{t('derived')}</div>
          <div className="mt-0.5">item_sold = {specs.DERIVED.item_sold}</div>
          <div>gmv       = {specs.DERIVED.gmv}</div>
          <div>net_gmv   = {specs.DERIVED.net_gmv}</div>
        </div>
        <div className="rounded bg-white px-2 py-1.5">
          <div className="font-sans text-[10px] font-semibold text-neutral-900">{t('exclusions')}</div>
          {specs.EXCLUSIONS.rules.map((rule) => (
            <div key={rule.code}>
              {rule.code.padEnd(10)} {rule.expression}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProductBreakdownTable({
  rows,
}: {
  rows: ShopeeMetricsPreview['result']['productBreakdown'];
}) {
  const t = useTranslations('uploadWizard.preview.breakdown');
  return (
    <div className="rounded-md border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
        {t('title', { count: rows.length })}
      </div>
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-neutral-50 text-[9px] uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-2 py-1.5 text-right">{t('col.num')}</th>
              <th className="px-2 py-1.5 text-left">{t('col.product')}</th>
              <th className="px-2 py-1.5 text-right">{t('col.units')}</th>
              <th className="px-2 py-1.5 text-right">{t('col.gmv')}</th>
              <th className="px-2 py-1.5 text-right">{t('col.netGmv')}</th>
              <th className="px-2 py-1.5 text-right">{t('col.nmv')}</th>
              <th className="px-2 py-1.5 text-right">{t('col.sellerDiscount')}</th>
              <th className="px-2 py-1.5 text-right">{t('col.primeCost')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={p.productName} className={cn('border-t border-neutral-100', i < 3 && 'bg-success-50/20')}>
                <td className="px-2 py-1 text-right font-mono text-neutral-500">{i + 1}</td>
                <td className="px-2 py-1 text-neutral-800">
                  <span className="line-clamp-1">{p.productName}</span>
                </td>
                <td className="px-2 py-1 text-right font-mono text-neutral-600">{p.units}</td>
                <td className="px-2 py-1 text-right font-mono text-neutral-900">{fmtCompact(p.gmv)}</td>
                <td className="px-2 py-1 text-right font-mono text-info-500">{fmtCompact(p.netGmv)}</td>
                <td className="px-2 py-1 text-right font-mono text-neutral-700">{fmtCompact(p.nmv)}</td>
                <td className="px-2 py-1 text-right font-mono text-warning-500">{fmtCompact(p.sellerDiscount)}</td>
                <td className="px-2 py-1 text-right font-mono text-error-500">{fmtCompact(p.primeCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
