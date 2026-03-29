import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { Store, LogIn, LogOut, Settings, Globe } from 'lucide-react';

const LANGUAGES = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'vi', label: 'Tiếng Việt' },
] as const;

export function Header() {
  const { t, i18n } = useTranslation('platform');
  const { isAuthenticated, isAdmin, user, clearAuth } = useAuthStore();

  const currentLang = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0];

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <Store className="h-6 w-6 text-blue-600" />
          AMA App Store
        </Link>
        <div className="flex items-center gap-3">
          {/* Language Switcher */}
          <div className="relative group">
            <button className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100">
              <Globe className="h-4 w-4" />
              {currentLang.label}
            </button>
            <div className="absolute right-0 z-50 mt-1 hidden min-w-[120px] rounded-md border bg-white py-1 shadow-lg group-hover:block">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => i18n.changeLanguage(lang.code)}
                  className={`block w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${
                    i18n.language === lang.code ? 'font-semibold text-blue-600' : 'text-gray-700'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

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
            <Link
              to="/apps/login"
              className="flex items-center gap-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <LogIn className="h-4 w-4" />
              {t('common.login')}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
