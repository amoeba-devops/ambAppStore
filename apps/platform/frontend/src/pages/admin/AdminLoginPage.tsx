import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Shield, LogIn, KeyRound, AlertCircle, Eye, EyeOff, Mail, Lock } from 'lucide-react';

import { useAuthStore } from '@/stores/auth.store';
import { apiClient } from '@/lib/api-client';

function decodeJwtPayload(token: string) {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    return payload;
  } catch {
    return null;
  }
}

export function AdminLoginPage() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isAdmin, setAuth } = useAuthStore();

  const [tokenInput, setTokenInput] = useState('');
  const [error, setError] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const amaLoginUrl = import.meta.env.VITE_AMA_LOGIN_URL;
  const amaStagingLoginUrl = import.meta.env.VITE_AMA_STAGING_LOGIN_URL || 'https://stg-ama.amoeba.site';
  const amaProdLoginUrl = import.meta.env.VITE_AMA_PROD_LOGIN_URL || 'https://ama.amoeba.site';
  const showDevLogin = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEV_LOGIN === 'true';

  // 이미 인증된 어드민이면 바로 리다이렉트
  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      navigate('/admin/subscriptions', { replace: true });
    }
  }, [isAuthenticated, isAdmin, navigate]);

  // URL 파라미터로 토큰이 넘어온 경우 자동 처리 (AMA SSO 콜백)
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      handleTokenLogin(token);
      // URL에서 토큰 제거 (보안)
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams]);

  function handleTokenLogin(token: string) {
    setError('');
    const payload = decodeJwtPayload(token);

    if (!payload) {
      setError(t('login.invalidToken'));
      return;
    }

    // 만료 확인
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      setError(t('login.tokenExpired'));
      return;
    }

    // ADMIN 권한 확인 (level 우선, roles 폴백)
    const level = payload.level || '';
    const roles = payload.roles || [];
    if (level !== 'ADMIN_LEVEL' && !roles.includes('ADMIN')) {
      setError(t('login.notAdmin'));
      return;
    }

    const user = {
      userId: payload.sub || payload.userId,
      entityId: payload.ent_id || payload.entityId,
      entityCode: payload.ent_code || payload.entityCode,
      email: payload.email || '',
      name: payload.name || '',
      level,
      roles,
    };

    setAuth(token, user);
    navigate('/admin/subscriptions', { replace: true });
  }

  function handleDevLogin(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = tokenInput.trim();
    if (!trimmed) {
      setError(t('login.enterToken'));
      return;
    }
    handleTokenLogin(trimmed);
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError(t('login.enterEmailPassword'));
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiClient.post('/v1/auth/login', {
        email: email.trim(),
        password: password.trim(),
      });

      if (res.data?.success && res.data?.data?.token) {
        handleTokenLogin(res.data.data.token);
      } else {
        setError(res.data?.error?.message || t('login.loginFailed'));
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || t('login.loginFailed');
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
            <Shield className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('login.title')}</h1>
          <p className="mt-2 text-sm text-gray-500">{t('login.subtitle')}</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {/* 에러 메시지 */}
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* AMA SSO 로그인 - 스테이징 & 프로덕션 */}
          <div className="space-y-3">
            <a
              href={`${amaStagingLoginUrl}/login?redirect_uri=${encodeURIComponent(window.location.origin + '/admin/login')}`}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              <LogIn className="h-4 w-4" />
              {t('login.loginWithAmaStaging')}
            </a>
            <a
              href={`${amaProdLoginUrl}/login?redirect_uri=${encodeURIComponent(window.location.origin + '/admin/login')}`}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              <LogIn className="h-4 w-4" />
              {t('login.loginWithAmaProd')}
            </a>
          </div>
          {showDevLogin && (
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs text-gray-400">OR</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
          )}

          {/* 이메일/비밀번호 로그인 */}
          <form onSubmit={handleEmailLogin} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                <Mail className="mr-1 inline h-3.5 w-3.5" />
                {t('login.emailLabel')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('login.emailPlaceholder')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                <Lock className="mr-1 inline h-3.5 w-3.5" />
                {t('login.passwordLabel')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('login.passwordPlaceholder')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-gray-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-900 disabled:opacity-50"
            >
              <LogIn className="h-4 w-4" />
              {isLoading ? t('login.loggingIn') : t('login.emailLogin')}
            </button>
          </form>

          {/* Dev/Staging: JWT 토큰 직접 입력 */}
          {showDevLogin && (
            <>
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs text-gray-400">DEV</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
              <form onSubmit={handleDevLogin}>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  <KeyRound className="mr-1 inline h-3.5 w-3.5" />
                  {t('login.devTokenLabel')}
                </label>
                <p className="mb-3 text-xs text-gray-400">{t('login.devTokenHint')}</p>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIs..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <button
                  type="submit"
                  className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  {t('login.devLogin')}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">{t('login.adminOnly')}</p>
      </div>
    </div>
  );
}
