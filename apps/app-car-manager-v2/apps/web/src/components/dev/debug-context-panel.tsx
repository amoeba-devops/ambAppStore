'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bug, Check, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { Button } from '@car-v2/ui';
import type { DecodedAmaJwt } from './decode-jwt';

export interface DebugServerContext {
  entId: string;
  userId: string;
  amaRole: string;
  role: string;
}

export interface DebugCookieMeta {
  exists: boolean;
  /** Seconds remaining until JWT exp (negative if already expired). */
  expiresInSec: number | null;
  /** ISO timestamp of JWT exp claim. */
  expiresAt: string | null;
}

export interface DebugContextPanelProps {
  /** Result of getCurrentUser() — null when middleware did not set headers. */
  serverContext: DebugServerContext | null;
  /** Cookie metadata read by the server. Value itself never crosses the boundary. */
  cookieMeta: DebugCookieMeta;
  /** Decoded payload of amb_session cookie. Null when cookie absent / decode fails. */
  decodedClaims: DecodedAmaJwt | null;
}

interface KeyValueRowProps {
  label: string;
  value: string | null | undefined;
  copyText?: string;
  copyAria: string;
  copiedAria: string;
}

function KeyValueRow({ label, value, copyText, copyAria, copiedAria }: KeyValueRowProps) {
  const [copied, setCopied] = useState(false);
  const display = value && value.length > 0 ? value : '—';
  const canCopy = !!copyText;

  async function handleCopy() {
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may be unavailable (insecure context, permission denied).
      // Silent failure is acceptable — this is a dev tool.
    }
  }

  return (
    <div className="flex items-start justify-between gap-3 py-1 text-xs">
      <span className="shrink-0 font-medium text-text-muted">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate font-mono text-text" title={display}>
          {display}
        </span>
        {canCopy && (
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? copiedAria : copyAria}
            className="shrink-0 rounded p-0.5 text-text-faint transition hover:bg-warning-soft hover:text-warning"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </button>
        )}
      </span>
    </div>
  );
}

export function DebugContextPanel({
  serverContext,
  cookieMeta,
  decodedClaims,
}: DebugContextPanelProps) {
  const t = useTranslations('debug');
  const [expanded, setExpanded] = useState(false);
  const [referrer, setReferrer] = useState<string>('');
  const [urlQuery, setUrlQuery] = useState<string>('');
  const [urlAmaToken, setUrlAmaToken] = useState<string>('');

  // Capture browser context at mount time. URL `?ama_token=` is normally
  // stripped by middleware before this component renders, but in some flows
  // (e.g. direct staging link with invalid token returning 401) the query
  // survives. The Referrer is the AMA portal origin when SSO redirected here.
  useEffect(() => {
    setReferrer(document.referrer || '');
    setUrlQuery(window.location.search.replace(/^\?/, ''));
    const params = new URLSearchParams(window.location.search);
    setUrlAmaToken(params.get('ama_token') || '');
  }, []);

  const expiresLabel = (() => {
    if (!cookieMeta.exists) return '—';
    if (cookieMeta.expiresInSec === null) return '—';
    if (cookieMeta.expiresInSec <= 0) return t('cookieExpired');
    const sec = cookieMeta.expiresInSec;
    if (sec >= 60) return `${Math.floor(sec / 60)} ${t('unitMinutes')}`;
    return `${sec} ${t('unitSeconds')}`;
  })();

  return (
    <div
      data-testid="debug-context-panel"
      className="mt-6 rounded-md border-2 border-dashed border-warning bg-warning-soft/30 p-3"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="debug-context-panel-body"
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2">
          <Bug className="h-4 w-4 text-warning" />
          <span className="text-sm font-semibold text-text">{t('title')}</span>
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-text-muted" />
        ) : (
          <ChevronDown className="h-4 w-4 text-text-muted" />
        )}
      </button>

      {expanded && (
        <div
          id="debug-context-panel-body"
          className="mt-3 space-y-3 border-t border-warning/40 pt-3"
        >
          {/* Browser context */}
          <section>
            <h3 className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-text-faint">
              {t('sectionBrowser')}
            </h3>
            <KeyValueRow
              label={t('referer')}
              value={referrer}
              copyAria={t('copy')}
              copiedAria={t('copied')}
            />
            <KeyValueRow
              label={t('queryParams')}
              value={urlQuery}
              copyAria={t('copy')}
              copiedAria={t('copied')}
            />
            <KeyValueRow
              label={t('amaTokenInUrl')}
              value={urlAmaToken ? `${urlAmaToken.slice(0, 24)}…` : ''}
              copyText={urlAmaToken || undefined}
              copyAria={t('copy')}
              copiedAria={t('copied')}
            />
          </section>

          {/* Server context */}
          <section>
            <h3 className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-text-faint">
              {t('sectionSession')}
            </h3>
            <KeyValueRow
              label={t('entId')}
              value={serverContext?.entId}
              copyText={serverContext?.entId}
              copyAria={t('copy')}
              copiedAria={t('copied')}
            />
            <KeyValueRow
              label={t('userId')}
              value={serverContext?.userId}
              copyText={serverContext?.userId}
              copyAria={t('copy')}
              copiedAria={t('copied')}
            />
            <KeyValueRow
              label={t('role')}
              value={
                serverContext
                  ? `${serverContext.role} (${t('amaRole')}: ${serverContext.amaRole})`
                  : null
              }
              copyAria={t('copy')}
              copiedAria={t('copied')}
            />
          </section>

          {/* Cookie meta */}
          <section>
            <h3 className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-text-faint">
              {t('sectionCookie')}
            </h3>
            <KeyValueRow
              label={t('cookiePresent')}
              value={cookieMeta.exists ? t('yes') : t('no')}
              copyAria={t('copy')}
              copiedAria={t('copied')}
            />
            <KeyValueRow
              label={t('cookieExpiresIn')}
              value={expiresLabel}
              copyAria={t('copy')}
              copiedAria={t('copied')}
            />
            <KeyValueRow
              label={t('cookieExpiresAt')}
              value={cookieMeta.expiresAt}
              copyAria={t('copy')}
              copiedAria={t('copied')}
            />
          </section>

          {/* Decoded JWT payload */}
          {decodedClaims && (
            <section>
              <h3 className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-text-faint">
                {t('sectionDecoded')}
              </h3>
              <KeyValueRow
                label="sub"
                value={typeof decodedClaims.sub === 'string' ? decodedClaims.sub : null}
                copyText={typeof decodedClaims.sub === 'string' ? decodedClaims.sub : undefined}
                copyAria={t('copy')}
                copiedAria={t('copied')}
              />
              <KeyValueRow
                label="entityId"
                value={
                  typeof decodedClaims.entityId === 'string' ? decodedClaims.entityId : null
                }
                copyText={
                  typeof decodedClaims.entityId === 'string' ? decodedClaims.entityId : undefined
                }
                copyAria={t('copy')}
                copiedAria={t('copied')}
              />
              <KeyValueRow
                label="email"
                value={typeof decodedClaims.email === 'string' ? decodedClaims.email : null}
                copyAria={t('copy')}
                copiedAria={t('copied')}
              />
              <KeyValueRow
                label="appCode"
                value={typeof decodedClaims.appCode === 'string' ? decodedClaims.appCode : null}
                copyAria={t('copy')}
                copiedAria={t('copied')}
              />
              <KeyValueRow
                label="scope"
                value={typeof decodedClaims.scope === 'string' ? decodedClaims.scope : null}
                copyAria={t('copy')}
                copiedAria={t('copied')}
              />
              <KeyValueRow
                label="iat"
                value={
                  typeof decodedClaims.iat === 'number'
                    ? `${decodedClaims.iat} (${new Date(decodedClaims.iat * 1000).toISOString()})`
                    : null
                }
                copyAria={t('copy')}
                copiedAria={t('copied')}
              />
              <KeyValueRow
                label="exp"
                value={
                  typeof decodedClaims.exp === 'number'
                    ? `${decodedClaims.exp} (${new Date(decodedClaims.exp * 1000).toISOString()})`
                    : null
                }
                copyAria={t('copy')}
                copiedAria={t('copied')}
              />
            </section>
          )}

          <div className="flex justify-end pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(false)}
              className="text-xs"
            >
              {t('collapse')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
