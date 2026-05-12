import { cn } from '@v2/ui';

interface PlaceholderPageProps {
  title: string;
  description: string;
  fr?: string;
  taskId?: string;
  status?: 'planned' | 'in_progress';
}

export function PlaceholderPage({
  title,
  description,
  fr,
  taskId,
  status = 'planned',
}: PlaceholderPageProps) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'rounded px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider',
              status === 'in_progress'
                ? 'bg-warning-50 text-warning-500'
                : 'bg-neutral-200 text-neutral-600',
            )}
          >
            {status === 'in_progress' ? 'In Progress' : 'Planned'}
          </span>
          {fr && (
            <span className="rounded bg-info-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-info-500">
              {fr}
            </span>
          )}
          {taskId && (
            <span className="rounded bg-neutral-200 px-2 py-0.5 font-mono text-[10px] font-semibold text-neutral-600">
              {taskId}
            </span>
          )}
        </div>
        <h2 className="mt-4 text-2xl font-semibold text-neutral-900">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">{description}</p>
        <div className="mt-6 rounded-md bg-neutral-100 p-4">
          <p className="font-mono text-xs text-neutral-600">
            Placeholder shell — fill content per PLAN-20260512-ui-mvp.md
          </p>
        </div>
      </div>
    </div>
  );
}
