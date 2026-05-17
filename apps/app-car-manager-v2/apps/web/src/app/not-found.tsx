import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Compass, Home } from 'lucide-react';
import { Button, Card, CardContent } from '@car-v2/ui';

export default async function NotFoundPage() {
  const t = await getTranslations('errors');
  return (
    <div className="min-h-dvh flex items-center justify-center bg-bg p-6">
      <Card variant="elevated" className="w-full max-w-md">
        <CardContent>
          <div className="flex flex-col items-center text-center py-2">
            <div className="h-14 w-14 rounded-full bg-accent-soft text-accent flex items-center justify-center mb-5">
              <Compass className="h-6 w-6" />
            </div>
            <div className="text-[11px] font-semibold text-text-faint uppercase tracking-wider">{t('notFoundLabel')}</div>
            <h1 className="mt-1 text-xl font-semibold text-text">{t('notFoundTitle')}</h1>
            <p className="mt-2 text-sm text-text-muted leading-relaxed max-w-xs">
              {t('notFoundDesc')}
            </p>

            <Button variant="accent" size="lg" className="mt-6 w-full" asChild>
              <Link href="/"><Home />{t('backToDashboard')}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
