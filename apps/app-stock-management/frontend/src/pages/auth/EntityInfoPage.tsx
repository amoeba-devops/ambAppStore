import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { authApi } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { useToastStore } from '@/stores/toast.store';

export function EntityInfoPage() {
  const { t } = useTranslation('stock');
  const navigate = useNavigate();
  const { setCrpCode } = useAuthStore();
  const { showToast } = useToastStore();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res = await authApi.validateEntity(code.trim());
      if (res.success) {
        setCrpCode(code.trim());
        navigate('/login');
      }
    } catch {
      showToast(t('auth.invalidEntity'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h2 className="mb-6 text-lg font-semibold text-gray-900">{t('auth.entityInfoTitle')}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t('auth.entityCode')}</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t('auth.entityCodePlaceholder')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
        >
          {loading ? '...' : t('auth.next')}
        </button>
      </form>
    </AuthLayout>
  );
}
