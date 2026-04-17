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

  const isPopup = !!window.opener;

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      handleResult(false, error);
      return;
    }

    if (!code) {
      handleResult(false, 'No authorization code');
      return;
    }

    amaApi
      .exchangeOAuthCode(code, state || '')
      .then(() => handleResult(true))
      .catch((err) => {
        handleResult(false, err?.response?.data?.error?.message || err.message || 'Unknown error');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleResult(success: boolean, error?: string) {
    if (success) {
      setStatus('success');
    } else {
      setStatus('error');
      setErrorMsg(error || '');
    }

    // 팝업 모드: 부모 창에 결과 전달 후 닫기
    if (isPopup && window.opener) {
      try {
        window.opener.postMessage(
          { type: 'AMA_OAUTH_CALLBACK', success, error },
          window.location.origin,
        );
      } catch { /* cross-origin 무시 */ }
      setTimeout(() => window.close(), success ? 500 : 2000);
      return;
    }

    // 일반 모드: 이전 페이지로 리다이렉트
    if (success) {
      setTimeout(() => navigate(-1), 1500);
    }
  }

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
            {isPopup && <p className="mt-2 text-xs text-gray-400">창이 자동으로 닫힙니다...</p>}
          </>
        )}
        {status === 'error' && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl">
              ✕
            </div>
            <p className="mb-2 text-sm font-medium text-red-600">{t('driverForm.oauthError')}</p>
            <p className="mb-4 text-xs text-gray-400">{errorMsg}</p>
            {!isPopup && (
              <button
                onClick={() => navigate(-1)}
                className="rounded-lg border border-[#d4d8e0] px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                {t('common.back')}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
