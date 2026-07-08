import clsx from 'clsx';
import { confidenceBand } from '@/types/hscode.types';

const STYLES: Record<'hi' | 'mid' | 'lo', string> = {
  hi: 'bg-ok-soft text-ok',
  mid: 'bg-warn-soft text-[#B45309]',
  lo: 'bg-bad-soft text-bad',
};

export default function ConfidenceBadge({ score }: { score: number }) {
  const band = confidenceBand(score);
  return (
    <span
      className={clsx(
        'whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12.5px] font-bold tabular-nums',
        STYLES[band],
      )}
    >
      {Math.round(score * 100)}%
    </span>
  );
}
