import { CheckCircle2, Circle, Loader2, XCircle, MinusCircle } from 'lucide-react';
import clsx from 'clsx';

export type StepStatus = 'wait' | 'running' | 'done' | 'skipped' | 'error';

export interface Step {
  key: string;
  label: string;
  status: StepStatus;
  hint?: string;
}

const ICON: Record<StepStatus, typeof CheckCircle2> = {
  wait: Circle,
  running: Loader2,
  done: CheckCircle2,
  skipped: MinusCircle,
  error: XCircle,
};

const COLOR: Record<StepStatus, string> = {
  wait: 'text-gray-300',
  running: 'text-blue-500',
  done: 'text-green-600',
  skipped: 'text-gray-400',
  error: 'text-red-500',
};

export function ProgressStepper({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((s) => {
        const Icon = ICON[s.status];
        return (
          <li key={s.key} className="flex items-start gap-3 text-sm">
            <Icon
              className={clsx(
                'h-5 w-5 flex-shrink-0',
                COLOR[s.status],
                s.status === 'running' && 'animate-spin',
              )}
            />
            <div className="flex-1">
              <div
                className={clsx(
                  'font-medium',
                  s.status === 'wait' ? 'text-gray-500' : 'text-gray-900',
                )}
              >
                {s.label}
              </div>
              {s.hint && (
                <div className="mt-0.5 text-xs text-gray-500">{s.hint}</div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
