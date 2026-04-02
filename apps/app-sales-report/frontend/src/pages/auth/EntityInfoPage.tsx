import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';

export function EntityInfoPage() {
  const { t } = useTranslation('sales');
  const navigate = useNavigate();
  const { setCrpCode } = useAuthStore();
  const [crpCode, setCrpCodeInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crpCode.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await apiClient.post('/v1/auth/ama-entry', { crp_code: crpCode.trim() });
      const { accessToken, refreshToken, user } = res.data.data;
      useAuthStore.getState().setAuth(accessToken, refreshToken, user);
      setCrpCode(crpCode.trim());
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-xl text-white">📊</div>
          <h1 className="text-lg font-bold text-gray-900">{t('common.appTitle')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('auth.entityInfo')}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('auth.entityCode')}</label>
            <input
              type="text"
              value={crpCode}
              onChange={(e) => setCrpCodeInput(e.target.value)}
              placeholder={t('auth.entityCodePlaceholder')}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || !crpCode.trim()}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? t('common.loading') : t('common.confirm')}
          </button>
        </form>
      </div>
    </div>
  );
}
