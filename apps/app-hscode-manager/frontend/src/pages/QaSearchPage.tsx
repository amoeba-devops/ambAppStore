import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ScreenHeader from '@/components/common/ScreenHeader';
import ConfidenceBadge from '@/components/common/ConfidenceBadge';
import CandidateCard from '@/components/qa/CandidateCard';
import { useQaConfirm, useQaSearch } from '@/hooks/useQa';
import type { AttributeKey, Candidate, SearchConstraints } from '@/types/hscode.types';

interface Turn {
  role: 'user' | 'sys';
  text: string;
}

export default function QaSearchPage() {
  const { t } = useTranslation('hscode');
  const navigate = useNavigate();
  const search = useQaSearch();
  const confirm = useQaConfirm();

  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [clarify, setClarify] = useState<AttributeKey | null>(null);
  const [clarifyAnswer, setClarifyAnswer] = useState('');

  const baseQuery = useRef('');
  const round = useRef(0);
  const constraints = useRef<SearchConstraints>({});

  const runSearch = async (query: string) => {
    try {
      const res = await search.mutateAsync({
        query_text: query,
        round_count: round.current,
        constraints: constraints.current,
      });
      setCandidates(res.candidates);
      setSelected(res.candidates[0] ?? null);
      setClarify(res.needQuestion ? (res.attributeKey ?? null) : null);
      if (res.needQuestion && res.attributeKey) {
        setTurns((p) => [...p, { role: 'sys', text: t(`qa.q.${res.attributeKey}`) }]);
      } else if (res.candidates.length === 0) {
        setTurns((p) => [...p, { role: 'sys', text: t('qa.empty') }]);
      }
    } catch {
      setTurns((p) => [...p, { role: 'sys', text: t('qa.error') }]);
    }
  };

  const onSend = () => {
    const q = input.trim();
    if (q.length < 2) return;
    baseQuery.current = q;
    round.current = 0;
    constraints.current = {};
    setTurns((p) => [...p, { role: 'user', text: q }]);
    setInput('');
    void runSearch(q);
  };

  const onAnswerClarify = () => {
    const a = clarifyAnswer.trim();
    if (!a || !clarify) return;
    constraints.current = { ...constraints.current, [clarify]: a };
    round.current += 1;
    setTurns((p) => [...p, { role: 'user', text: a }]);
    setClarifyAnswer('');
    setClarify(null);
    void runSearch(baseQuery.current);
  };

  const onConfirm = async () => {
    if (!selected) return;
    const res = await confirm.mutateAsync({
      input_text: baseQuery.current,
      hs_code: selected.hsCode,
      hs6: selected.hs6,
      confidence: selected.score,
      hsr_id: selected.sourceRefId ?? undefined,
    });
    navigate(`/result/${res.logId}`);
  };

  return (
    <section>
      <ScreenHeader id="SCR-001" title={t('qa.title')} sub={t('qa.sub')} />

      <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.15fr_0.85fr]">
        {/* 대화 */}
        <div className="mt-4 rounded-xl border border-line bg-white p-5">
          <h3 className="mb-3.5 text-[14.5px] font-semibold">{t('qa.conv')}</h3>

          <div className="flex min-h-[320px] flex-col gap-3.5">
            {turns.map((turn, i) => (
              <div
                key={i}
                className={
                  turn.role === 'user'
                    ? 'self-end max-w-[82%] rounded-[14px] rounded-br-[4px] bg-brand px-3.5 py-2.5 text-[13.5px] text-white'
                    : 'self-start max-w-[82%] rounded-[14px] rounded-bl-[4px] border border-line bg-[#f3f4f6] px-3.5 py-2.5 text-[13.5px]'
                }
              >
                {turn.text}
              </div>
            ))}
            {search.isPending && (
              <div className="self-start rounded-[14px] border border-line bg-[#f3f4f6] px-3.5 py-2.5 text-[13.5px] text-muted">
                …
              </div>
            )}

            {candidates.length > 0 && (
              <div className="mt-1 flex flex-col gap-2.5">
                {candidates.map((c, i) => (
                  <CandidateCard
                    key={`${c.hs6}-${i}`}
                    candidate={c}
                    best={i === 0}
                    selected={selected?.hsCode === c.hsCode}
                    onSelect={setSelected}
                  />
                ))}
              </div>
            )}

            {clarify && (
              <div className="mt-1 flex gap-2.5">
                <input
                  value={clarifyAnswer}
                  onChange={(e) => setClarifyAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onAnswerClarify()}
                  placeholder={t('qa.answer')}
                  className="flex-1 rounded-s border border-line2 px-3 py-2.5 text-[13.5px] outline-none focus:border-brand"
                />
                <button
                  onClick={onAnswerClarify}
                  className="rounded-s bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-brand-dark"
                >
                  {t('qa.send')}
                </button>
              </div>
            )}
          </div>

          <div className="mt-3.5 flex gap-2.5 border-t border-line pt-3.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSend()}
              placeholder={t('qa.ph')}
              className="flex-1 rounded-s border border-line2 px-3 py-2.5 text-[13.5px] outline-none focus:border-brand"
            />
            <button
              onClick={onSend}
              disabled={input.trim().length < 2 || search.isPending}
              className="rounded-s bg-brand px-[18px] py-2.5 text-[13.5px] font-semibold text-white hover:bg-brand-dark disabled:opacity-45"
            >
              {t('qa.send')}
            </button>
          </div>
        </div>

        {/* 선택한 후보 */}
        <div className="mt-4 rounded-xl border border-line bg-white p-5">
          <h3 className="mb-3.5 text-[14.5px] font-semibold">{t('qa.selected')}</h3>
          {selected ? (
            <>
              <div className="rounded-[10px] border border-line bg-gradient-to-b from-white to-[#fafbff] p-4">
                <div className="flex items-center gap-3">
                  <span className="text-[26px] font-extrabold tabular-nums">{selected.hsCode}</span>
                  <ConfidenceBadge score={selected.score} />
                </div>
                <div className="mt-4 grid grid-cols-[110px_1fr] gap-y-2 text-[13px]">
                  <span className="font-semibold text-muted">{t('k.name')}</span>
                  <span className="font-semibold">{selected.description}</span>
                  {selected.origin && (
                    <>
                      <span className="font-semibold text-muted">{t('k.origin')}</span>
                      <span className="font-semibold">{selected.origin}</span>
                    </>
                  )}
                  {selected.unit && (
                    <>
                      <span className="font-semibold text-muted">{t('k.unit')}</span>
                      <span className="font-semibold">{selected.unit}</span>
                    </>
                  )}
                  <span className="font-semibold text-muted">{t('k.basis')}</span>
                  <span className="font-semibold">{selected.refCount}</span>
                </div>
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <button
                  onClick={onConfirm}
                  disabled={confirm.isPending}
                  className="rounded-s bg-brand px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-brand-dark disabled:opacity-45"
                >
                  {t('qa.confirm')}
                </button>
              </div>
            </>
          ) : (
            <p className="text-[13px] text-muted">{t('qa.altcta')}</p>
          )}
        </div>
      </div>
    </section>
  );
}
