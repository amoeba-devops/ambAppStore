import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useMatchRequest, useMatchConfirm } from '@/hooks/useMatching';
import type { MatchItem } from '@/types/agent.types';

/** 신뢰도 → 색상 등급. */
function grade(score: number): { dot: string; text: string; label: string } {
  if (score >= 0.7) return { dot: 'bg-ok', text: 'text-ok', label: '🟢' };
  if (score >= 0.5) return { dot: 'bg-warn', text: 'text-warn', label: '🟡' };
  return { dot: 'bg-bad', text: 'text-bad', label: '🔴' };
}

/** SCR-2 — 매칭 결과 = 확인·승인. HS 크게, 신뢰도 색상, 근거 접이식, 일괄 승인. */
export default function MatchResultPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation('hscode');
  const { data, isLoading } = useMatchRequest(id);
  const confirm = useMatchConfirm(id ?? '');

  // 선택된 HS(품목별, 기본=1순위), 체크(승인 대상), 펼침 상태.
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const items = data?.items ?? [];

  // 최초 로딩 시 기본값 세팅(1순위 HS 선택, needsReview 아니면 체크).
  useEffect(() => {
    if (!items.length) return;
    setSelected((s) => {
      const next = { ...s };
      for (const it of items) {
        const top = it.recommendations[0];
        if (top && next[it.itemId] === undefined) next[it.itemId] = top.hsVn;
      }
      return next;
    });
    setChecked((c) => {
      const next = { ...c };
      for (const it of items) {
        if (it.recommendations.length && next[it.itemId] === undefined) {
          next[it.itemId] = !it.needsReview;
        }
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (isLoading) return <div className="py-10 text-center text-muted">{t('common.loading')}</div>;
  if (!data) return <div className="py-10 text-center text-muted">{t('m.notFound')}</div>;

  const req = data.request;
  const approvedCount = items.filter((i) => checked[i.itemId] && selected[i.itemId]).length;
  const reviewCount = items.filter((i) => i.needsReview).length;
  const isConfirmed = req.status === 'CONFIRMED';
  const isProcessing = req.status === 'PROCESSING';
  const pct = req.itemCount > 0 ? Math.round((req.processedCount / req.itemCount) * 100) : 0;

  const toggleAll = (on: boolean) => {
    const next: Record<string, boolean> = {};
    for (const it of items) if (it.recommendations.length) next[it.itemId] = on;
    setChecked(next);
  };

  const save = () => {
    const approvals = items
      .filter((i) => checked[i.itemId] && selected[i.itemId])
      .map((i) => ({ item_id: i.itemId, hs_code: selected[i.itemId] }));
    if (approvals.length) confirm.mutate(approvals);
  };

  return (
    <div className="py-6">
      {/* 헤더 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/match" className="text-xs font-semibold text-muted hover:text-brand">
            ← {t('m.title')}
          </Link>
          <h1 className="text-lg font-extrabold text-ink">{req.fileName ?? req.mrqId}</h1>
          <p className="text-xs text-muted">
            🇻🇳 {t('m.baseVN')} · {t('m.itemsN', { n: req.itemCount })} ·{' '}
            {t('m.reviewN', { n: reviewCount })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleAll(true)}
            disabled={isConfirmed || isProcessing}
            className="rounded-lg border border-line2 px-3 py-2 text-xs font-bold text-muted hover:border-brand hover:text-brand disabled:opacity-50"
          >
            {t('m.selectAll')}
          </button>
          <button
            onClick={save}
            disabled={isConfirmed || isProcessing || confirm.isPending || approvedCount === 0}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {confirm.isPending
              ? t('common.saving')
              : t('m.saveApproved', { n: approvedCount })}
          </button>
        </div>
      </div>

      {isProcessing && (
        <div className="mb-4 rounded-lg bg-info-soft px-4 py-3">
          <div className="flex items-center justify-between text-sm font-semibold text-info">
            <span>⏳ {t('m.analyzingN', { done: req.processedCount, total: req.itemCount })}</span>
            <span>{pct}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-info transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {isConfirmed && (
        <div className="mb-4 rounded-lg bg-ok-soft px-4 py-2.5 text-sm font-semibold text-ok">
          ✓ {t('m.confirmedNote', { n: req.confirmedCount })}
        </div>
      )}

      {/* 품목 리스트 */}
      <div className="space-y-2">
        {items.map((it) => (
          <ItemRow
            key={it.itemId}
            item={it}
            selected={selected[it.itemId]}
            checked={!!checked[it.itemId]}
            expanded={!!expanded[it.itemId]}
            disabled={isConfirmed || isProcessing}
            onToggleCheck={() =>
              setChecked((c) => ({ ...c, [it.itemId]: !c[it.itemId] }))
            }
            onSelect={(hs) => setSelected((s) => ({ ...s, [it.itemId]: hs }))}
            onToggleExpand={() =>
              setExpanded((e) => ({ ...e, [it.itemId]: !e[it.itemId] }))
            }
          />
        ))}
      </div>
    </div>
  );
}

function ItemRow({
  item,
  selected,
  checked,
  expanded,
  disabled,
  onToggleCheck,
  onSelect,
  onToggleExpand,
}: {
  item: MatchItem;
  selected: string | undefined;
  checked: boolean;
  expanded: boolean;
  disabled: boolean;
  onToggleCheck: () => void;
  onSelect: (hs: string) => void;
  onToggleExpand: () => void;
}) {
  const { t } = useTranslation('hscode');
  const top = item.recommendations[0];
  const chosen = item.recommendations.find((r) => r.hsVn === selected) ?? top;
  const g = chosen ? grade(chosen.confidence) : null;
  const adopted = item.recommendations.find((r) => r.finalUserAction === 'ADOPTED');

  return (
    <div
      className={clsx(
        'rounded-xl border bg-white px-4 py-3',
        item.needsReview ? 'border-bad/40' : 'border-line',
      )}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled || !top}
          onChange={onToggleCheck}
          className="mt-1 h-4 w-4 shrink-0 accent-brand"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-ink">
            {item.name || <span className="text-bad">{t('m.noName')}</span>}
          </div>
          {(item.material || item.usage) && (
            <div className="truncate text-xs text-muted">
              {[item.material, item.usage].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>

        {/* HS + 신뢰도 */}
        {chosen ? (
          <button onClick={onToggleExpand} className="shrink-0 text-right">
            <div className="text-lg font-extrabold tracking-tight text-ink">
              {formatHs(adopted?.hsVn ?? chosen.hsVn)}
            </div>
            <div className={clsx('flex items-center justify-end gap-1 text-xs font-bold', g?.text)}>
              <span className={clsx('h-2 w-2 rounded-full', g?.dot)} />
              {Math.round(chosen.confidence * 100)}%
              {item.recommendations.length > 1 && (
                <span className="text-muted">{expanded ? ' ▲' : ' ▾'}</span>
              )}
            </div>
          </button>
        ) : (
          <div className="shrink-0 rounded-md bg-bad-soft px-2 py-1 text-xs font-bold text-bad">
            ⚠ {t('m.needReview')}
          </div>
        )}
      </div>

      {/* 상태 배지 */}
      <div className="mt-1 flex items-center gap-2 pl-7">
        {adopted && (
          <span className="rounded bg-ok-soft px-1.5 py-0.5 text-[11px] font-bold text-ok">
            ✓ {t('m.adopted')}
          </span>
        )}
        {chosen?.isEscalationRequired && (
          <span className="rounded bg-warn-soft px-1.5 py-0.5 text-[11px] font-bold text-warn">
            ⚠ {t('m.preRuling')}
          </span>
        )}
      </div>

      {/* 펼침: 후보 + 근거 */}
      {expanded && chosen && (
        <div className="mt-3 space-y-2 border-t border-line pt-3 pl-7">
          {item.recommendations.map((r) => (
            <label
              key={r.recId}
              className={clsx(
                'flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5',
                r.hsVn === selected ? 'bg-brand-soft' : 'hover:bg-line/40',
              )}
            >
              <input
                type="radio"
                name={`hs-${item.itemId}`}
                checked={r.hsVn === selected}
                disabled={disabled}
                onChange={() => onSelect(r.hsVn)}
                className="mt-0.5 accent-brand"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-ink">{formatHs(r.hsVn)}</span>
                  <span className={clsx('text-xs font-bold', grade(r.confidence).text)}>
                    {Math.round(r.confidence * 100)}%
                  </span>
                </div>
                <div className="text-xs text-muted">{r.reasoning}</div>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/** 8자리 → 4.2.2 형식. */
function formatHs(hs: string): string {
  const d = (hs ?? '').replace(/\D/g, '');
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}.${d.slice(4)}`;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}`;
}
