import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bug, Copy, Check, ChevronUp, ChevronDown } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { decodeAmaToken } from '@/lib/ama-token';

/**
 * AMA SSO 컨텍스트 디버그 판넬 (우측 하단 고정).
 * AMA를 통해 접속한 사용자 정보(스토어 user + hsc_token payload)를 표현한다.
 * 전역 스토어는 읽기 전용으로만 사용. 전 환경 상시 노출.
 */
export function DebugContextPanel() {
  const { t } = useTranslation('hscode');
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token) || localStorage.getItem('hsc_token') || '';
  const isAdmin = useAuthStore((s) => s.isAdmin)();

  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const payload = token ? decodeAmaToken(token) : null;

  const expLabel = (() => {
    if (!payload?.exp) return '—';
    const d = new Date(payload.exp * 1000);
    const expired = payload.exp * 1000 < Date.now();
    return `${d.toLocaleString()} (${expired ? t('debug.expired') : t('debug.valid')})`;
  })();

  const rolesLabel = user?.roles?.length
    ? `${user.roles.join(', ')}${isAdmin ? ` (${t('debug.admin')})` : ''}`
    : '—';

  const rows: Array<[string, string]> = [
    [t('debug.name'), user?.name || '—'],
    [t('debug.email'), user?.email || '—'],
    [t('debug.roles'), rolesLabel],
    [t('debug.entityId'), user?.entityId || '—'],
    [t('debug.entityCode'), user?.entityCode || '—'],
    [t('debug.appCode'), (payload as { appCode?: string } | null)?.appCode || '—'],
    [t('debug.scope'), payload?.scope || '—'],
    [t('debug.expiry'), expLabel],
    [t('debug.authStatus'), token ? t('debug.authed') : t('debug.noToken')],
  ];

  const rawContent = [
    `─── ${t('debug.referrer')} ───`,
    document.referrer || '(empty)',
    '',
    `─── ${t('debug.params')} ───`,
    window.location.search || '(empty)',
    '',
    `─── ${t('debug.jwt')} ───`,
    token || '(no token)',
    '',
    `─── ${t('debug.payload')} ───`,
    payload ? JSON.stringify(payload, null, 2) : '(no token)',
  ].join('\n');

  const copyContent = [
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    rawContent,
  ].join('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard 미지원 환경 무시 */
    }
  };

  return (
    <div className="fixed bottom-0 right-4 z-50">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="mb-1 flex items-center gap-1.5 rounded-t-lg bg-yellow-400 px-3 py-1.5 text-xs font-medium text-yellow-900 shadow-md transition-colors hover:bg-yellow-500"
      >
        <Bug className="h-3.5 w-3.5" />
        {t('debug.title')}
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
      </button>

      {expanded && (
        <div className="max-h-[70vh] w-[460px] max-w-[92vw] overflow-y-auto rounded-tl-lg border-2 border-dashed border-yellow-400 bg-yellow-50 shadow-lg">
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-xs font-semibold text-yellow-800">{t('debug.section.user')}</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-yellow-700 transition-colors hover:bg-yellow-200"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? t('debug.copied') : t('debug.copy')}
            </button>
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-yellow-300 bg-white px-3 py-2 text-xs">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="whitespace-nowrap font-medium text-gray-500">{k}</dt>
                <dd className="break-all font-mono text-gray-800">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="px-3 pb-2">
            <span className="text-xs font-semibold text-yellow-800">{t('debug.section.raw')}</span>
            <textarea
              readOnly
              value={rawContent}
              rows={12}
              className="mt-1 w-full resize-y rounded border border-yellow-300 bg-white p-2 font-mono text-[11px] text-gray-800 focus:outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
