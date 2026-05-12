'use client';

import { usePathname } from 'next/navigation';
import type { LocalRole } from '@v2/shared/auth';
import { Header } from './Header';
import { pageTitleForPath } from './page-title';

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
  return <Header title={pageTitleForPath(pathname)} user={user} />;
}
