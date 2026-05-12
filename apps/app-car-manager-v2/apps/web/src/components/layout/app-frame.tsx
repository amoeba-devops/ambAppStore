import type { ReactNode } from 'react';
import { Sidebar } from './sidebar';
import { TopBar } from './topbar';

type Props = {
  title: string;
  subtitle?: string;
  breadcrumbs?: string[];
  actions?: ReactNode;
  children: ReactNode;
};

export async function AppFrame({ title, subtitle, breadcrumbs, actions, children }: Props) {
  return (
    <div className="flex h-screen bg-[#f7f8fa] text-neutral-800 font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar title={title} subtitle={subtitle} breadcrumbs={breadcrumbs} actions={actions} />
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
