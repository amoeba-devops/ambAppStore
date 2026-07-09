import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useChatSend } from '@/hooks/useChat';
import type { ChatMessage } from '@/types/agent.types';

/** SCR-3 — Q&A 챗봇. 자연어 질문 → RAG 근거 대화형 답변. */
export default function ChatPage() {
  const { t } = useTranslation('hscode');
  const send = useChatSend();
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, send.isPending]);

  const submit = () => {
    const text = input.trim();
    if (!text || send.isPending) return;
    setInput('');
    // 낙관적 사용자 메시지.
    const optimistic: ChatMessage = {
      msgId: `tmp-${Date.now()}`,
      role: 'USER',
      content: text,
      candidates: [],
      citations: [],
      needQuestion: false,
      source: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    send.mutate(
      { message: text, sessionId },
      {
        onSuccess: (res) => {
          setSessionId(res.session.chtId);
          setMessages((m) => [...m.filter((x) => x.msgId !== optimistic.msgId), res.userMessage, res.assistantMessage]);
        },
        onError: () => {
          setMessages((m) => m.filter((x) => x.msgId !== optimistic.msgId));
          setInput(text);
        },
      },
    );
  };

  return (
    <div className="flex h-[calc(100vh-140px)] flex-col py-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-extrabold text-ink">{t('c.title')}</h1>
        <span className="text-xs font-semibold text-muted">🇻🇳 {t('m.baseVN')}</span>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-line bg-white px-4 py-4">
        {messages.length === 0 && !send.isPending && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted">
            <div className="text-4xl">💬</div>
            <div className="text-sm">{t('c.empty')}</div>
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.msgId} m={m} />
        ))}
        {send.isPending && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-line/50 px-4 py-2 text-sm text-muted">…</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* 입력 */}
      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={t('c.placeholder')}
          className="flex-1 rounded-lg border border-line2 px-4 py-2.5 text-sm outline-none focus:border-brand"
        />
        <button
          onClick={submit}
          disabled={send.isPending || !input.trim()}
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {t('c.send')}
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ m }: { m: ChatMessage }) {
  const { t } = useTranslation('hscode');
  const [showCite, setShowCite] = useState(false);
  const isUser = m.role === 'USER';

  return (
    <div className={clsx('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={clsx('max-w-[80%] space-y-2', isUser ? 'items-end' : 'items-start')}>
        <div
          className={clsx(
            'whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm',
            isUser ? 'bg-brand text-white' : 'bg-line/40 text-ink',
          )}
        >
          {m.content}
        </div>

        {!isUser && m.candidates.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {m.candidates.map((c) => (
              <span
                key={c.hsCode}
                className="rounded-lg border border-line2 bg-white px-2 py-1 text-xs font-bold text-ink"
                title={c.rationale}
              >
                {c.hsCode} · {Math.round(c.confidence * 100)}%
              </span>
            ))}
          </div>
        )}

        {!isUser && (m.citations.length > 0 || m.source) && (
          <div className="text-xs text-muted">
            {m.source === 'SEARCH_FALLBACK' && (
              <span className="mr-2 rounded bg-warn-soft px-1.5 py-0.5 font-semibold text-warn">
                {t('c.searchBased')}
              </span>
            )}
            {m.citations.length > 0 && (
              <button onClick={() => setShowCite((s) => !s)} className="font-semibold hover:text-brand">
                {t('c.evidence', { n: m.citations.length })} {showCite ? '▲' : '▾'}
              </button>
            )}
            {showCite && (
              <ul className="mt-1 space-y-1 border-l-2 border-line pl-2">
                {m.citations.map((cit, i) => (
                  <li key={i} className="text-[11px] text-muted">
                    <span className="font-semibold">[{cit.type === 'REFERENCE' ? t('c.ref') : t('c.knowledge')}]</span>{' '}
                    {cit.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
