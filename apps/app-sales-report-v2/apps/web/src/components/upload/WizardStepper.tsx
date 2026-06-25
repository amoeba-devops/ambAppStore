'use client';

import { Check } from 'lucide-react';
import { cn } from '@v2/ui';

export interface WizardStep {
  id: number;
  label: string;
}

interface WizardStepperProps {
  steps: WizardStep[];
  current: number;
  completed: number[];
  onStepClick?: (stepId: number) => void;
}

export function WizardStepper({ steps, current, completed, onStepClick }: WizardStepperProps) {
  return (
    <ol className="flex w-full items-center">
      {steps.map((step, idx) => {
        const isActive = step.id === current;
        const isDone = completed.includes(step.id);
        const isClickable = (isDone || step.id <= current) && !!onStepClick;
        return (
          <li key={step.id} className="flex flex-1 items-center last:flex-none">
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onStepClick(step.id)}
              className={cn(
                'flex items-center gap-2 text-sm',
                isClickable ? 'cursor-pointer' : 'cursor-default',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
                  isActive || isDone
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-500 ring-1 ring-neutral-200',
                )}
              >
                {isDone && !isActive ? <Check className="h-3.5 w-3.5" /> : step.id}
              </span>
              <span
                className={cn(
                  'whitespace-nowrap',
                  isActive
                    ? 'font-semibold text-neutral-900'
                    : isDone
                      ? 'text-neutral-700'
                      : 'text-neutral-500',
                )}
              >
                {step.label}
              </span>
            </button>
            {idx < steps.length - 1 && <div className="mx-3 h-px flex-1 bg-neutral-200" />}
          </li>
        );
      })}
    </ol>
  );
}
