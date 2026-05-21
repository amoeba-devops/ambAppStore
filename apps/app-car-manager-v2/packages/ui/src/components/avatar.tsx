import { forwardRef } from 'react';
import { cn } from '../cn.js';

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name?: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-11 w-11 text-md',
  xl: 'h-14 w-14 text-lg',
} as const;

function initials(name?: string) {
  if (!name) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length === 0 || !words[0]) return '?';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return ((words[0]![0] ?? '') + (words[words.length - 1]![0] ?? '')).toUpperCase();
}

/* Stable hashed accent — keeps avatars distinguishable without theming. */
const palette = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-6', 'bg-chart-8'];
function hash(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length]!;
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, name = '', src, size = 'md', ...props }, ref) => {
    const bg = hash(name);
    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-full text-white font-semibold select-none overflow-hidden shrink-0',
          sizeMap[size],
          !src && bg,
          className,
        )}
        aria-label={name || undefined}
        {...props}
      >
        {src ? (
          <img src={src} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span>{initials(name)}</span>
        )}
      </div>
    );
  },
);
Avatar.displayName = 'Avatar';
