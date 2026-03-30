import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { Store, LogIn, LogOut, Settings, Globe, ClipboardList, Building2 } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';

const LANGUAGES = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'vi', label: 'Tiếng Việt' },
] as const;

/** AMA entity-settings/custom-apps 에서 iframe으로 열린 경우 감지 */
function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true; // cross-origin iframe이면 접근 차단 → iframe 확정
  }
}

/** referrer 도메인 추출 (ama.amoeba.site 등) */
function getReferrerDomain(): string | null {
  try {
    const ref = document.referrer;
    if (!ref) return null;
    const url = new URL(ref);
    return url.hostname;
  } catch {
    return null;
  }
}

export function Header() {
  const { t, i18n } = useTranslation('platform');
  const { isAuthenticated, isAdmin, user, clearAuth } = useAuthStore();
  const embedded = isEmbedded();
  const [referrerDomain, setReferrerDomain] = useState<string | null>(null);

  useEffect(() => {
    if (embedded) {
      setReferrerDomain(getReferrerDomain());
    }
  }, [embedded]);

  const currentLang = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0];

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <Store className="h-6 w-6 text-blue-600" />
          AMA App Store
        </Link>
        <div className="flex items-center gap-3">
          {/* Entity info badge (embedded iframe) */}
          {embedded && isAuthenticated && user?.entityCode && (
            <span className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
              <Building2 className="h-3.5 w-3.5 text-gray-500" />
              <span className="font-medium">{user.entityCode}</span>
              <span className="text-gray-400">·</span>
              <span>{user.name}</span>
              {referrerDomain && (
                <>
                  <span className="text-gray-300">|</span>
                  <span className="text-xs text-gray-400">{referrerDomain}</span>
                </>
              )}
            </span>
          )}

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
              <Link
                to="/my-subscriptions"
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
              >
                <ClipboardList className="h-4 w-4" />
                {t('mySubscriptions.title')}
              </Link>
              <NotificationBell />
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
          ) : !embedded ? (
            <Link
              to="/apps/login"
              className="flex items-center gap-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <LogIn className="h-4 w-4" />
              {t('common.login')}
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
