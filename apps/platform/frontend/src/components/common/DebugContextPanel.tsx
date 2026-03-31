import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Copy, Check, Bug } from 'lucide-react';

const LS_KEY = 'debug_panel_enabled';

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
  const { t } = useTranslation('platform');
  const [enabled, setEnabled] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Listen for storage changes (from admin toggle)
  const checkEnabled = useCallback(() => {
    setEnabled(localStorage.getItem(LS_KEY) === 'true');
  }, []);

  useEffect(() => {
    checkEnabled();
    const handler = () => checkEnabled();
    window.addEventListener('storage', handler);
    window.addEventListener('debug-panel-toggle', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('debug-panel-toggle', handler);
    };
  }, [checkEnabled]);

  if (!enabled) return null;

  const token = localStorage.getItem('ama_token') || '';
  const entityRaw = sessionStorage.getItem('entity_context') || '';
  const currentParams = window.location.search;

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
    currentParams || '(empty)',
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
    <div className="border-t-2 border-dashed border-yellow-400 bg-yellow-50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-2 text-left text-sm font-medium text-yellow-800 hover:bg-yellow-100 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Bug className="h-4 w-4" />
          {t('debug.title')}
        </span>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4">
          <div className="flex justify-end mb-1">
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
            className="w-full rounded border border-yellow-300 bg-white p-3 font-mono text-xs text-gray-800 focus:outline-none resize-y"
          />
        </div>
      )}
    </div>
  );
}
