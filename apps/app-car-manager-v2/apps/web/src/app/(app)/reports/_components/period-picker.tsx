'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu';
import { Button, cn } from '@car-v2/ui';

export interface PeriodOption {
  key: string;
  weeks: number;
  label: string;
}

export interface PeriodPickerProps {
  options: PeriodOption[];
  currentWeeks: number;
  labels: {
    period: string;
  };
}

export function PeriodPicker({ options, currentWeeks, labels }: PeriodPickerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentOption = options.find((o) => o.weeks === currentWeeks) ?? options[0]!;

  const handleSelect = (weeks: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (weeks === 12) {
      // Default - remove param
      params.delete('weeks');
    } else {
      params.set('weeks', String(weeks));
    }
    const qs = params.toString();
    router.push(qs ? `/reports?${qs}` : '/reports');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="md" iconLeft={<Calendar />}>
          {currentOption.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="z-50 min-w-[180px] rounded-lg border border-border bg-surface p-1 shadow-lg"
      >
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.key}
            onSelect={() => handleSelect(opt.weeks)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer',
              'hover:bg-surface-2 focus:bg-surface-2 focus:outline-none',
              opt.weeks === currentWeeks
                ? 'text-accent font-medium'
                : 'text-text',
            )}
          >
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
