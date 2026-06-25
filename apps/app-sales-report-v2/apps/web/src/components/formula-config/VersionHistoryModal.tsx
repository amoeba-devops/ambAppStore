'use client';

import { useEffect } from 'react';
import { X, History as HistoryIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@v2/ui';
import type { FormulaVersion } from '@/lib/formula-version-mock';

interface Props {
  metric: string;
  currentFormula: string;
  dataSources: string[];
  unit?: string;
  history: FormulaVersion[];
  onClose: () => void;
}

export function VersionHistoryModal({
  metric,
  currentFormula,
  dataSources,
  unit,
  history,
  onClose,
}: Props) {
  const t = useTranslations('formulaConfig.history');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 backdrop-blur-sm px-4 text-left"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-6xl rounded-xl bg-white shadow-2xl overflow-hidden text-left"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-neutral-100 px-6 py-4 bg-gradient-to-b from-neutral-50 to-white">
          <div className="flex items-start gap-3 min-w-0">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-info-50 shrink-0">
              <HistoryIcon className="h-4 w-4 text-info-500" />
            </span>
            <div className="flex flex-col items-start text-left min-w-0">
              <span className="text-[10px] uppercase tracking-wider text-neutral-400 leading-tight">
                {t('title')}
              </span>
              <span className="mt-0.5 text-sm font-semibold text-neutral-900 font-mono leading-tight">
                {renderMetricName(metric)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5" />
            {t('close')}
          </button>
        </div>

        {/* Summary strip */}
        <div className="flex items-center gap-6 px-6 py-2.5 bg-neutral-50/60 border-b border-neutral-100 text-xs text-neutral-500">
          <span>
            {history.length > 1
              ? t('versionCountPlural', { count: history.length })
              : t('versionCount', { count: history.length })}
          </span>
          <span className="text-neutral-300">·</span>
          <span>{t('latestChange', { at: history[0]?.changedAt ?? '—' })}</span>
        </div>

        {/* Table */}
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
            <thead className="sticky top-0 z-10 bg-white border-b border-neutral-100 text-[10px] uppercase tracking-wider text-neutral-500">
              <tr>
                <th
                  style={{ width: '56px' }}
                  className="pl-6 pr-3 py-3 text-left font-semibold"
                >
                  {t('col.num')}
                </th>
                <th
                  style={{ width: '200px' }}
                  className="px-3 py-3 text-left font-semibold"
                >
                  {t('col.metric')}
                </th>
                <th className="px-3 py-3 text-left font-semibold">{t('col.formula')}</th>
                <th
                  style={{ width: '140px' }}
                  className="px-3 py-3 text-left font-semibold"
                >
                  {t('col.reason')}
                </th>
                <th
                  style={{ width: '200px' }}
                  className="px-3 py-3 text-left font-semibold"
                >
                  {t('col.effective')}
                </th>
                <th
                  style={{ width: '200px' }}
                  className="px-3 py-3 text-left font-semibold"
                >
                  {t('col.changedBy')}
                </th>
                <th
                  style={{ width: '110px' }}
                  className="pl-3 pr-6 py-3 text-left font-semibold"
                >
                  {t('col.status')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {history.map((v, i) => {
                const isActive = v.status === 'Active';
                const versionNum = history.length - i;
                return (
                  <tr
                    key={i}
                    className={cn(
                      'transition-colors',
                      isActive
                        ? 'bg-info-50/40 border-l-2 border-info-500'
                        : 'hover:bg-neutral-50/60',
                    )}
                  >
                    <td className="pl-6 pr-3 py-4 align-top text-left">
                      <span
                        className={cn(
                          'inline-flex items-center justify-center rounded-md px-1.5 py-0.5 text-[10px] font-mono font-semibold tabular-nums',
                          isActive ? 'bg-info-500 text-white' : 'bg-neutral-100 text-neutral-500',
                        )}
                      >
                        v{versionNum}
                      </span>
                    </td>
                    <td className="px-3 py-4 align-top text-left">
                      <div className="font-mono text-xs font-semibold text-neutral-900 leading-5">
                        {renderMetricName(metric)}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {dataSources.map((s) => (
                          <span
                            key={s}
                            className="inline-flex items-center rounded bg-info-50 px-1.5 py-0.5 text-[10px] font-medium text-info-500"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                      {unit && (
                        <div className="mt-1 text-[10px] uppercase tracking-wider text-neutral-400">
                          {t('unit')} <span className="text-neutral-600">{unit}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-4 align-top text-left">
                      <span className="font-mono text-xs leading-5 text-neutral-900 break-words">
                        {highlightFormula(v.formula)}
                      </span>
                    </td>
                    <td className="px-3 py-4 align-top text-left">
                      {v.reason ? (
                        <span className="text-xs text-neutral-700">{v.reason}</span>
                      ) : (
                        <span className="text-xs text-neutral-300">{t('noReason')}</span>
                      )}
                    </td>
                    <td className="px-3 py-4 align-top text-left">
                      <span className="font-mono text-xs text-neutral-700 whitespace-nowrap">
                        {v.effectivePeriod}
                      </span>
                    </td>
                    <td className="px-3 py-4 align-top text-left">
                      <div className="text-xs font-medium text-neutral-700 truncate">
                        {v.changedBy}
                      </div>
                      <div className="mt-0.5 text-[11px] text-neutral-400 tabular-nums whitespace-nowrap">
                        {v.changedAt}
                      </div>
                    </td>
                    <td className="pl-3 pr-6 py-4 align-top text-left">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
                          isActive
                            ? 'bg-success-500/10 text-success-500'
                            : 'bg-neutral-100 text-neutral-500',
                        )}
                      >
                        <span
                          className={cn(
                            'inline-block h-1.5 w-1.5 rounded-full',
                            isActive ? 'bg-success-500' : 'bg-neutral-400',
                          )}
                        />
                        {v.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** Render `Foo — Shopee` with the suffix dimmed (matches Formula Config table). */
function renderMetricName(name: string): React.ReactNode {
  const m = name.match(/^(.*?)(\s—\s(?:Shopee|TikTok))$/);
  if (!m) return name;
  return (
    <>
      {m[1]}
      <span className="text-neutral-400 font-normal">{m[2]}</span>
    </>
  );
}

/**
 * Lightweight token highlighter for read-only formula display in the modal.
 * Orange = {token}, green = [literal/parameter]. No semantic resolution
 * (we don't know which sources were selected at the time of the change).
 */
function highlightFormula(text: string): React.ReactNode {
  if (!text) return null;
  if (text === '(default)' || text === '(adjusted)') {
    return <span className="italic text-neutral-400">{text}</span>;
  }
  const parts: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const nextCurly = text.indexOf('{', i);
    const nextSquare = text.indexOf('[', i);
    let open: number;
    let isSquare: boolean;
    if (nextCurly === -1 && nextSquare === -1) {
      parts.push(<span key={key++}>{text.slice(i)}</span>);
      break;
    } else if (nextCurly === -1) {
      open = nextSquare;
      isSquare = true;
    } else if (nextSquare === -1) {
      open = nextCurly;
      isSquare = false;
    } else {
      open = Math.min(nextCurly, nextSquare);
      isSquare = open === nextSquare;
    }
    if (open > i) parts.push(<span key={key++}>{text.slice(i, open)}</span>);
    const closeChar = isSquare ? ']' : '}';
    const close = text.indexOf(closeChar, open);
    if (close === -1) {
      parts.push(<span key={key++}>{text.slice(open)}</span>);
      break;
    }
    parts.push(
      <span key={key++} className={isSquare ? 'text-success-500' : 'text-accent-700'}>
        {text.slice(open, close + 1)}
      </span>,
    );
    i = close + 1;
  }
  return parts;
}
