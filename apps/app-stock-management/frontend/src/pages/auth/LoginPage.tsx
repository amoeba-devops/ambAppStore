import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { authApi } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { useToastStore } from '@/stores/toast.store';

export function LoginPage() {
  const { t } = useTranslation('stock');
  const navigate = useNavigate();
  const { crpCode, setAuth } = useAuthStore();
  const { showToast } = useToastStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crpCode) { navigate('/entity-info'); return; }
    setLoading(true);
    try {
      const res = await authApi.login({ crp_code: crpCode, email, password });
      if (res.success) {
        const d = res.data;
        setAuth(d.accessToken, d.refreshToken, {
          userId: d.userId,
          entId: d.entId,
          crpCode: d.crpCode,
          role: d.role,
          name: d.name,
          tempPassword: d.tempPassword,
        });
        if (d.tempPassword) {
          navigate('/change-password');
        } else {
          navigate('/');
        }
      }
    } catch {
      showToast(t('auth.loginFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h2 className="mb-6 text-lg font-semibold text-gray-900">{t('auth.loginTitle')}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t('auth.email')}</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t('auth.password')}</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
        </div>
        <button type="submit" disabled={loading} className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50">
          {loading ? '...' : t('auth.login')}
        </button>
      </form>
    </AuthLayout>
  );
}
