import type { TextareaHTMLAttributes } from 'react';
import { cn } from '@car-v2/ui/cn';

type Props = { error?: boolean } & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ error, className, rows = 4, ...rest }: Props) {
  return (
    <textarea
      {...rest}
      rows={rows}
      className={cn(
        'bg-white border rounded-lg px-3 py-2 text-[13.5px] text-neutral-800 placeholder:text-neutral-400 outline-none resize-y',
        error ? 'border-danger-500' : 'border-neutral-150',
        className,
      )}
    />
  );
}
