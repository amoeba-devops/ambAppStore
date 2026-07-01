import { getLocale, getTranslations } from 'next-intl/server';
import { LogIn, Building2, Mail, ExternalLink, BookOpen } from 'lucide-react';
import { Button, Card, CardContent } from '@car-v2/ui';
import { DEV_PERSONAS, loginHrefFor, localRoleFor } from '@/lib/dev/test-personas';
import { LoginLanguageSwitcher } from './_components/login-language-switcher';

/**
 * D-010 rev — Phone-login page cho driver/manager/admin (no password).
 *
 * Form 2 field: ent_code + phone. Admin gửi cho user qua SMS/Zalo template.
 * Submit → /api/auth/login → AMA phone-login → cookie 30d.
 *
 * Mobile-first (viewport 320px+) nhưng cũng work trên desktop.
 *
 * Language switcher pinned to the top-right of the card — user can flip
 * between vi / en / ko before signing in. The choice persists via the
 * `NEXT_LOCALE` cookie set by `setLocaleAction` and survives across the
 * auth flow.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const demoEnabled = process.env.DEMO_AUTO_LOGIN === 'true';
  const amaWebUrl = process.env.NEXT_PUBLIC_AMA_WEB_URL ?? 'https://ama.amoeba.site';
  const t = await getTranslations('login');
  const tNav = await getTranslations('nav');
  const locale = await getLocale();

  /* User-guide URL — basePath + locale-specific landing. The login page is
   * the one place a user might land BEFORE they know what the app is about,
   * so a "what is this?" entry point matters more here than anywhere else
   * in the shell. EN viewers fall back to the VI doc (KO/VI are the only
   * published locales). */
  const guideBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const guideLocale = locale === 'ko' ? 'ko' : 'vi';
  const userGuideHref = `${guideBasePath}/docs/user-guide/${guideLocale}/index.html`;

  return (
    <div data-auth-theme className="min-h-dvh flex items-center justify-center bg-bg p-4">
      <Card variant="elevated" className="w-full max-w-sm">
        <CardContent>
          {/* Language switcher sits above the card header so it's the first
           * thing a user notices if they need a different language. Right-
           * aligned to keep the brand circle visually centred below. */}
          <div className="flex justify-end mb-3">
            <LoginLanguageSwitcher ariaLabel={t('languageLabel')} />
          </div>

          <div className="flex flex-col items-center text-center py-2">
            <div className="h-14 w-14 rounded-full bg-accent-soft text-accent flex items-center justify-center mb-5">
              <LogIn className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-semibold text-text">{t('title')}</h1>
            <p className="mt-1 text-sm text-text-muted">{t('subtitle')}</p>
          </div>

          <form action="/api/auth/login" method="POST" className="mt-6 space-y-4">
            {error && (
              <div className="rounded-md bg-danger-soft text-danger text-sm p-3">
                {resolveErrorMessage(error, t)}
              </div>
            )}

            {next && <input type="hidden" name="next" value={next} />}

            <div>
              <label
                htmlFor="ent_code"
                className="block text-sm font-medium text-text mb-1"
              >
                {t('entCodeLabel')}
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-faint" />
                <input
                  id="ent_code"
                  name="ent_code"
                  type="text"
                  required
                  autoCapitalize="characters"
                  autoComplete="organization"
                  placeholder={t('entCodePlaceholder')}
                  className="w-full rounded-md border border-border bg-surface pl-10 pr-3 py-3 text-base uppercase focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-text mb-1"
              >
                {t('emailLabel')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-faint" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  inputMode="email"
                  autoComplete="email"
                  placeholder={t('emailPlaceholder')}
                  className="w-full rounded-md border border-border bg-surface pl-10 pr-3 py-3 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
              <p className="mt-1 text-xs text-text-faint">{t('emailHint')}</p>
            </div>

            {/* Mặc định "Ghi nhớ thiết bị 30 ngày" — input hidden để route /api/auth/login set cookie 30d */}
            <input type="hidden" name="remember" value="on" />

            <Button type="submit" variant="accent" size="lg" className="w-full">
              <LogIn className="h-4 w-4" />
              {t('submit')}
            </Button>
          </form>

          {/* Footer links — pre-login affordances for users who landed here
           * without an existing session. "Open AMA" sends them to the SSO
           * portal; "User Guide" opens the static docs site so a brand-new
           * visitor can read what the app is and how onboarding works
           * BEFORE they have credentials to log in. */}
          <div className="mt-5 pt-4 border-t border-border space-y-2.5">
            <a
              href={amaWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-sm text-accent hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t('openAma')}
            </a>
            <a
              href={userGuideHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={tNav('userGuideAria')}
              className="flex items-center justify-center gap-2 text-sm text-text-muted hover:text-text hover:underline"
            >
              <BookOpen className="h-3.5 w-3.5" />
              {tNav('userGuide')}
            </a>
          </div>

          {demoEnabled && (
            <div data-testid="dev-mode-section" className="mt-6 pt-5 border-t border-border">
              <div className="text-[10.5px] font-semibold text-text-faint uppercase tracking-wider mb-3">
                {t('devTitle')}
              </div>
              {/* Every role × department persona, one click each. `loginHrefFor`
               * carries the fixed `sub` so dept-scoped managers/drivers get the
               * right fleet access (generic /dev-login?role= alone wouldn't). */}
              <div className="grid grid-cols-1 gap-2">
                {DEV_PERSONAS.map((p) => (
                  <Button key={p.key} variant="secondary" size="md" asChild>
                    <a href={loginHrefFor(p)}>
                      {t(`devPersona.${p.key}`)}
                      <span className="font-semibold text-accent ml-1.5 text-xs uppercase">
                        {localRoleFor(p)}
                      </span>
                    </a>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function resolveErrorMessage(error: string, t: (key: string) => string): string {
  switch (error) {
    case 'missing':         return t('errMissing');
    case 'invalid':         return t('errInvalid');
    case 'rate_limit':      return t('errRateLimit');
    case 'not_installed':   return t('errNotInstalled');
    case 'not_implemented': return t('errNotImplemented');
    case 'server':          return t('errServer');
    default:                return t('errFallback');
  }
}
