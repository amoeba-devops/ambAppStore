'use client';

import Link from 'next/link';
import { Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { LocalRole } from '@v2/shared/auth';
import type { WeekPoint } from '@/lib/trends-mock';
import type { ActionLogRow } from '@/server/actions/action-log.actions';
import { HeroKpis } from './HeroKpis';
import { QuickActions } from './QuickActions';
import { RecentActivity } from './RecentActivity';

interface Props {
  role: LocalRole;
  weekPoints: WeekPoint[];
  recentLogs: ActionLogRow[];
}

export function DashboardClient({ role, weekPoints, recentLogs }: Props) {
  const t = useTranslations('dashboard');
  const hasData = weekPoints.length > 0;

  if (!hasData) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
        <h2 className="text-base font-semibold text-neutral-900">{t('emptyTitle')}</h2>
        <p className="mt-2 max-w-md mx-auto text-sm text-neutral-500">{t('emptyBody')}</p>
        <Link
          href="/upload"
          className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-info-500 px-4 py-2 text-sm font-semibold text-white hover:bg-info-500/90"
        >
          <Upload className="h-4 w-4" />
          {t('uploadCta')}
        </Link>
        <div className="mt-8">
          <QuickActions role={role} />
        </div>
      </div>
    );
  }

  return (
    <>
      <HeroKpis weekPoints={weekPoints} />
      <QuickActions role={role} />
      <RecentActivity rows={recentLogs} />
    </>
  );
}
