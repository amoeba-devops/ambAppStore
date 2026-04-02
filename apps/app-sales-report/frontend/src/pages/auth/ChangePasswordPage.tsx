import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/api-client';

export function ChangePasswordPage() {
  const { t } = useTranslation('sales');
  const navigate = useNavigate();
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');

    try {
      await apiClient.post('/v1/auth/change-password', {
        current_password: currentPw,
        new_password: newPw,
      });
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
        <h1 className="mb-6 text-center text-lg font-bold text-gray-900">{t('auth.changePassword')}</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('auth.currentPassword')}</label>
            <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('auth.newPassword')}</label>
            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('auth.confirmPassword')}</label>
            <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {loading ? t('common.loading') : t('common.confirm')}
          </button>
        </form>
      </div>
    </div>
  );
}
