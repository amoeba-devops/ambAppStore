import type { ReactNode } from 'react';

/**
 * Detail-page shell — used for /trips/[id], /vehicles/[id], /drivers/[id].
 * Layout: tabs (optional) → 2-column (main | aside).
 */
type Props = {
  tabs?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
};

export function DetailPageShell({ tabs, children, aside }: Props) {
  return (
    <div className="flex flex-col h-full">
      {tabs && <div className="pb-4">{tabs}</div>}
      <div
        className="flex-1 min-h-0 grid gap-5"
        style={{ gridTemplateColumns: aside ? '1fr 340px' : '1fr' }}
      >
        <div className="overflow-auto">{children}</div>
        {aside && <aside className="overflow-auto">{aside}</aside>}
      </div>
    </div>
  );
}
