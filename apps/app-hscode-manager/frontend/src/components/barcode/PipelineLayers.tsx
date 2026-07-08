import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { PipelineLayer } from '@/types/gtin.types';

const LAYER_LABEL: Record<PipelineLayer['key'], string> = {
  L1: 'bc.l1',
  L2: 'bc.l2',
  L3: 'bc.l3',
  L4: 'bc.l4',
};

const STATUS_STYLE: Record<string, string> = {
  hit: 'bg-ok-soft text-ok',
  done: 'bg-ok-soft text-ok',
  chosen: 'bg-brand-soft text-brand-dark',
  miss: 'bg-[#f3f4f6] text-muted',
  unused: 'bg-[#f3f4f6] text-muted',
};

export default function PipelineLayers({ layers }: { layers: PipelineLayer[] }) {
  const { t } = useTranslation('hscode');
  return (
    <div className="flex flex-col gap-2">
      {layers.map((l, i) => {
        const active = l.status === 'hit' || l.status === 'chosen' || l.status === 'done';
        return (
          <div
            key={l.key}
            className={clsx(
              'flex items-center gap-3 rounded-[9px] border px-3 py-2.5 text-[13px]',
              active ? 'border-transparent bg-brand-soft' : 'border-line',
              l.status === 'unused' && 'opacity-60',
            )}
          >
            <span
              className={clsx(
                'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[7px] text-xs font-extrabold',
                active ? 'bg-brand text-white' : 'bg-[#f3f4f6] text-muted',
              )}
            >
              {i + 1}
            </span>
            <span className="flex-1 font-semibold">{t(LAYER_LABEL[l.key])}</span>
            <span
              className={clsx(
                'rounded-md px-2 py-0.5 text-[11px] font-bold',
                STATUS_STYLE[l.status] ?? 'bg-[#f3f4f6] text-muted',
              )}
            >
              {t(`bc.${l.status}`)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
