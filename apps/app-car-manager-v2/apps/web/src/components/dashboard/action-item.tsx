import { Icon, type IconName } from '../primitives/icon';
import { StatusPill } from '../primitives/status-pill';

type Props = {
  icon: IconName;
  iconColor: string;
  bg: string;
  title: string;
  meta: string;
  tag: string;
  tagKind: Parameters<typeof StatusPill>[0]['kind'];
};

export function ActionItem({ icon, iconColor, bg, title, meta, tag, tagKind }: Props) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-neutral-75 last:border-b-0">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: bg }}
      >
        <Icon name={icon} size={16} color={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-neutral-800 leading-snug">{title}</div>
        <div className="text-[11.5px] text-neutral-400 mt-0.5">{meta}</div>
      </div>
      {tag && <StatusPill kind={tagKind} label={tag} dense />}
    </div>
  );
}
