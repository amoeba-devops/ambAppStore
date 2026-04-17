import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { amaApi } from '@/services/api';

export function OAuthCallbackPage() {
  const { t } = useTranslation('car');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setErrorMsg(error);
      return;
    }

    if (!code) {
      setStatus('error');
      setErrorMsg('No authorization code');
      return;
    }

    amaApi
      .exchangeOAuthCode(code, state || '')
      .then(() => {
        setStatus('success');
        setTimeout(() => navigate(-1), 1500);
      })
      .catch((err) => {
        setStatus('error');
        setErrorMsg(err?.response?.data?.error?.message || err.message || 'Unknown error');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="rounded-xl border border-[#e2e5eb] bg-white p-8 text-center shadow-sm">
        {status === 'loading' && (
          <>
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-orange-500" />
            <p className="text-sm text-gray-500">{t('driverForm.oauthConnecting')}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl">
              ✓
            </div>
            <p className="text-sm font-medium text-green-700">{t('driverForm.oauthSuccess')}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl">
              ✕
            </div>
            <p className="mb-2 text-sm font-medium text-red-600">{t('driverForm.oauthError')}</p>
            <p className="mb-4 text-xs text-gray-400">{errorMsg}</p>
            <button
              onClick={() => navigate(-1)}
              className="rounded-lg border border-[#d4d8e0] px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              {t('common.back')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
