'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { LocalRole } from '@v2/shared/auth';
import { Header } from './Header';
import { pageTitleKeyForPath } from './page-title';

export function PageTitleHeader({
  user,
}: {
  user: {
    name?: string;
    email?: string;
    role: LocalRole;
    userId: string;
  };
}) {
  const pathname = usePathname();
  const t = useTranslations('pageTitle');
  return <Header title={t(pageTitleKeyForPath(pathname))} user={user} />;
}
