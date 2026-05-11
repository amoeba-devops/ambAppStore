import { redirect } from '@/i18n/navigation';
import { auth } from '@/lib/auth/auth';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';

export default async function DashboardSectionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect({ href: '/login', locale: locale as 'en' | 'ko' | 'vi' });
  }

  return (
    <div className="flex min-h-screen bg-muted/40">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar userName={session?.user?.name ?? session?.user?.email ?? ''} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
