import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Copy, Check, Bug } from 'lucide-react';

function decodeJwtPayload(token: string): string {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return '(invalid token)';
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.stringify(JSON.parse(atob(base64)), null, 2);
  } catch {
    return '(decode error)';
  }
}

interface DebugContextPanelProps {
  initialReferrer: string;
  initialQueryParams: string;
}

export function DebugContextPanel({ initialReferrer, initialQueryParams }: DebugContextPanelProps) {
  const { t } = useTranslation('car');
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const token = localStorage.getItem('ama_token') || '';
  const entityRaw = sessionStorage.getItem('entity_context') || '';

  let entityFormatted = '';
  if (entityRaw) {
    try {
      entityFormatted = JSON.stringify(JSON.parse(entityRaw), null, 2);
    } catch {
      entityFormatted = entityRaw;
    }
  }

  const content = [
    `─── ${t('debug.referer')} ───`,
    initialReferrer || '(empty)',
    '',
    `─── ${t('debug.initialParams')} ───`,
    initialQueryParams || '(empty)',
    '',
    `─── ${t('debug.currentParams')} ───`,
    window.location.search || '(empty)',
    '',
    `─── ${t('debug.jwtToken')} ───`,
    token || '(no token)',
    '',
    `─── ${t('debug.jwtPayload')} ───`,
    token ? decodeJwtPayload(token) : '(no token)',
    '',
    `─── ${t('debug.entityContext')} ───`,
    entityFormatted || '(no entity context)',
  ].join('\n');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed bottom-0 right-4 z-50">
      {/* Toggle button - always above the panel */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`mb-1 flex items-center gap-1.5 rounded-t-lg px-3 py-1.5 text-xs font-medium shadow-md transition-colors ${
          expanded
            ? 'bg-yellow-400 text-yellow-900 hover:bg-yellow-500'
            : 'bg-yellow-400 text-yellow-900 hover:bg-yellow-500'
        }`}
      >
        <Bug className="h-3.5 w-3.5" />
        {t('debug.title')}
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
      </button>
      {/* Expandable panel */}
      {expanded && (
        <div className="w-[480px] rounded-tl-lg border-2 border-dashed border-yellow-400 bg-yellow-50 shadow-lg">
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-xs font-medium text-yellow-800">{t('debug.title')}</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-yellow-700 hover:bg-yellow-200 transition-colors"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? t('debug.copied') : t('debug.copy')}
            </button>
          </div>
          <textarea
            readOnly
            value={content}
            rows={16}
            className="w-full border-t border-yellow-300 bg-white p-3 font-mono text-xs text-gray-800 focus:outline-none resize-y"
          />
        </div>
      )}
    </div>
  );
}
