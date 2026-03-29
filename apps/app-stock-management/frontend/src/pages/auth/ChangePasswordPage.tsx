import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { authApi } from '@/services/api';
import { useToastStore } from '@/stores/toast.store';

export function ChangePasswordPage() {
  const { t } = useTranslation('stock');
  const navigate = useNavigate();
  const { showToast } = useToastStore();
  const [current, setCurrent] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirm) { showToast(t('auth.passwordMismatch'), 'error'); return; }
    setLoading(true);
    try {
      await authApi.changePassword({ current_password: current, new_password: newPw });
      showToast(t('auth.changePassword') + ' ✓', 'success');
      navigate('/');
    } catch {
      showToast('Failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h2 className="mb-2 text-lg font-semibold text-gray-900">{t('auth.changePasswordTitle')}</h2>
      <p className="mb-6 text-sm text-orange-600">{t('auth.tempPasswordNotice')}</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t('auth.currentPassword')}</label>
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t('auth.newPassword')}</label>
          <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t('auth.confirmPassword')}</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
        </div>
        <button type="submit" disabled={loading} className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50">
          {loading ? '...' : t('auth.changePassword')}
        </button>
      </form>
    </AuthLayout>
  );
}
