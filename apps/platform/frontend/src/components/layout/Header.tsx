import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { Store, LogIn, LogOut, Settings } from 'lucide-react';

export function Header() {
  const { t } = useTranslation('platform');
  const { isAuthenticated, isAdmin, user, clearAuth } = useAuthStore();

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <Store className="h-6 w-6 text-blue-600" />
          AMA App Store
        </Link>
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              {isAdmin && (
                <Link
                  to="/admin"
                  className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
                >
                  <Settings className="h-4 w-4" />
                  Admin
                </Link>
              )}
              <span className="text-sm text-gray-600">{user?.name}</span>
              <button
                onClick={clearAuth}
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
              >
                <LogOut className="h-4 w-4" />
                {t('common.logout')}
              </button>
            </>
          ) : (
            <a
              href={import.meta.env.VITE_AMA_LOGIN_URL || '#'}
              className="flex items-center gap-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <LogIn className="h-4 w-4" />
              {t('common.login')}
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
