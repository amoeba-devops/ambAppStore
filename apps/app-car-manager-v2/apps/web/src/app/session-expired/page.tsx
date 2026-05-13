import { getTranslations } from 'next-intl/server';
import { LogIn, ShieldOff } from 'lucide-react';
import { Button, Card, CardContent } from '@car-v2/ui';

export default async function SessionExpiredPage() {
  const tA  = await getTranslations('actions');
  const tCo = await getTranslations('company');
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
            <h1 className="text-xl font-semibold text-text">Session expired</h1>
            <p className="mt-2 text-sm text-text-muted leading-relaxed max-w-xs">
              Your access to <span className="font-medium text-text">{tCo('tenant')}</span> has timed out. Return to
              amoeba management to re-open the app.
            </p>
            <Button
              variant="accent"
              size="lg"
              className="mt-6 w-full"
              asChild
            >
              <a href={amaOrigin}><LogIn />Open ambManagement</a>
            </Button>
          </div>

          {demoEnabled && (
            <div className="mt-6 pt-5 border-t border-border">
              <div className="text-[10.5px] font-semibold text-text-faint uppercase tracking-wider mb-3">
                Dev login · local only
              </div>
              <div className="grid grid-cols-1 gap-2">
                {(['OWNER', 'MANAGER', 'MEMBER'] as const).map((role) => (
                  <Button key={role} variant="secondary" size="md" asChild>
                    <a href={`/dev-login?role=${role}`}>
                      Sign in as <span className="font-semibold text-accent ml-1">
                        {role === 'OWNER' ? 'ADMIN' : role === 'MEMBER' ? 'DRIVER' : 'MANAGER'}
                      </span>
                    </a>
                  </Button>
                ))}
              </div>
              <p className="mt-3 text-xs text-text-faint">
                Active because <code className="font-mono bg-surface-2 px-1 rounded">DEMO_AUTO_LOGIN=true</code>.
                Disable in production.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
