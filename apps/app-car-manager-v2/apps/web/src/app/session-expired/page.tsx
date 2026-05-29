import { getTranslations } from 'next-intl/server';
import { LogIn, ShieldOff } from 'lucide-react';
import { Button, Card, CardContent } from '@car-v2/ui';

/**
 * Debug provider is imported conditionally on the static `NODE_ENV` constant
 * so webpack's DCE drops the import statement (and the transitive client
 * panel chunk) from production builds. The provider has its own runtime
 * `DEBUG_PANEL_ENABLED` check for staging.
 */
const DebugContextProvider =
  process.env.NODE_ENV !== 'production'
    ? (await import('@/components/dev/debug-context-provider')).DebugContextProvider
    : null;

export default async function SessionExpiredPage() {
  const tCo = await getTranslations('company');
  const tS  = await getTranslations('sessionExpired');
  const amaOrigin = process.env.NEXT_PUBLIC_AMA_ORIGIN ?? 'https://ama.amoeba.site';
  const demoEnabled = process.env.DEMO_AUTO_LOGIN === 'true';

  return (
    <div className="min-h-dvh flex items-center justify-center bg-bg p-6">
      <Card variant="elevated" className="w-full max-w-md">
        <CardContent>
          <div className="flex flex-col items-center text-center py-2">
            <div className="h-14 w-14 rounded-full bg-warning-soft text-warning flex items-center justify-center mb-5">
              <ShieldOff className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-semibold text-text">{tS('title')}</h1>
            <p className="mt-2 text-sm text-text-muted leading-relaxed max-w-xs">
              {tS('descPrefix')} <span className="font-medium text-text">{tCo('tenant')}</span> {tS('descSuffix')}
            </p>
            <Button
              variant="accent"
              size="lg"
              className="mt-6 w-full"
              asChild
            >
              <a href={amaOrigin}><LogIn />{tS('openAma')}</a>
            </Button>
          </div>

          {demoEnabled && (
            <div className="mt-6 pt-5 border-t border-border">
              <div className="text-[10.5px] font-semibold text-text-faint uppercase tracking-wider mb-3">
                {tS('devLoginTitle')}
              </div>
              <div className="grid grid-cols-1 gap-2">
                {(['OWNER', 'MANAGER', 'MEMBER'] as const).map((role) => (
                  <Button key={role} variant="secondary" size="md" asChild>
                    <a href={`/dev-login?role=${role}`}>
                      {tS('signInAs')} <span className="font-semibold text-accent ml-1">
                        {role === 'OWNER' ? 'ADMIN' : role === 'MEMBER' ? 'DRIVER' : 'MANAGER'}
                      </span>
                    </a>
                  </Button>
                ))}
              </div>
              <p className="mt-3 text-xs text-text-faint">
                {tS('demoNotePrefix')} <code className="font-mono bg-surface-2 px-1 rounded">DEMO_AUTO_LOGIN=true</code>{tS('demoNoteSuffix')}
              </p>
            </div>
          )}

          {/* Dev/staging-only debug panel. Removed from prod bundle by
              static NODE_ENV gate above. */}
          {DebugContextProvider && <DebugContextProvider />}
        </CardContent>
      </Card>
    </div>
  );
}
