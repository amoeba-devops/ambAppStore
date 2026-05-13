import { Loader2 } from 'lucide-react';
import { cn } from '../cn.js';

interface SpinnerProps extends React.HTMLAttributes<SVGSVGElement> {
  size?: number;
}

export function Spinner({ size = 16, className, ...props }: SpinnerProps) {
  return (
    <Loader2
      width={size}
      height={size}
      aria-hidden
      className={cn('animate-spin text-current motion-reduce:animate-none', className)}
      {...props}
    />
  );
}
