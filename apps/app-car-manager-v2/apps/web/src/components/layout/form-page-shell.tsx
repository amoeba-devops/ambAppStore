import type { ReactNode } from 'react';

/**
 * Form-page shell — used for /trips/new, /settings, vehicle/driver/user add-edit.
 * Layout: 2-column (form sections | optional aside: summary/preview/conflicts),
 * sticky save bar at bottom.
 */
type Props = {
  children: ReactNode;
  aside?: ReactNode;
  /** Save bar at bottom — typically Cancel + Save Draft + Submit */
  saveBar?: ReactNode;
};

export function FormPageShell({ children, aside, saveBar }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 grid gap-5" style={{ gridTemplateColumns: aside ? '1fr 360px' : '1fr' }}>
        <div className="overflow-auto pr-1">{children}</div>
        {aside && <aside className="overflow-auto">{aside}</aside>}
      </div>
      {saveBar && (
        <div className="border-t border-neutral-100 bg-white -mx-7 px-7 py-3.5 mt-4 flex items-center justify-end gap-2 sticky bottom-0">
          {saveBar}
        </div>
      )}
    </div>
  );
}
