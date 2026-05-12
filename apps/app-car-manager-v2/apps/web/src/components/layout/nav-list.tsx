'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@car-v2/ui/cn';
import { Icon } from '../primitives/icon';
import { NAV_ITEMS, activeKeyFor, type NavKey } from './nav-config';

type Labels = Record<NavKey, string> & { workspace: string; admin: string };

export function NavList({ labels }: { labels: Labels }) {
  const pathname = usePathname();
  const active = activeKeyFor(pathname);

  const workspace = NAV_ITEMS.filter((i) => i.group === 'workspace');
  const admin = NAV_ITEMS.filter((i) => i.group === 'admin');

  return (
    <nav className="px-2 flex-1 overflow-auto">
      <SectionLabel>{labels.workspace}</SectionLabel>
      {workspace.map((it) => (
        <NavItem key={it.key} item={it} label={labels[it.key]} active={active === it.key} />
      ))}
      <SectionLabel className="mt-[18px]">{labels.admin}</SectionLabel>
      {admin.map((it) => (
        <NavItem key={it.key} item={it} label={labels[it.key]} active={active === it.key} />
      ))}
    </nav>
  );
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'text-[10.5px] font-bold text-neutral-400 uppercase tracking-[0.08em] px-2.5 pb-1.5 pt-2.5',
        className,
      )}
    >
      {children}
    </div>
  );
}

function NavItem({
  item,
  label,
  active,
}: {
  item: (typeof NAV_ITEMS)[number];
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-[11px] px-2.5 py-2 rounded-md mb-0.5 text-[13px] transition-colors',
        active
          ? 'bg-brand-50 text-brand-700 font-semibold'
          : 'text-neutral-600 font-medium hover:bg-neutral-50',
      )}
    >
      <Icon name={item.icon} size={17} color={active ? '#2566db' : '#7e8799'} />
      <div className="flex-1">{label}</div>
      {item.staticBadge && (
        <div
          className={cn(
            'text-[10.5px] font-bold px-1.5 py-px rounded-full',
            active ? 'bg-brand-100 text-brand-700' : 'bg-neutral-100 text-neutral-600',
          )}
        >
          {item.staticBadge}
        </div>
      )}
    </Link>
  );
}
