import { Icon } from '../primitives/icon';
import { StatusPill } from '../primitives/status-pill';
import { Avatar } from '../primitives/avatar';

type Vehicle = {
  plate: string;
  model: string;
  color: string;
  km: number;
  driver: string;
  nextOil: number;
};

type Trip = { from: string; to: string; driver: string; remaining: string };
type Next = { to: string; at: string };

type State = 'running' | 'ready' | 'maintenance';

type StateMeta = {
  tag: string;
  kind: Parameters<typeof StatusPill>[0]['kind'];
};

const STATE: Record<State, StateMeta> = {
  running:     { tag: 'In progress', kind: 'purple' },
  ready:       { tag: 'Available',   kind: 'success' },
  maintenance: { tag: 'Maintenance', kind: 'warn' },
};

type Props = {
  v: Vehicle;
  state: State;
  trip?: Trip;
  next?: Next;
  detail?: string;
};

export function FleetCard({ v, state, trip, next, detail }: Props) {
  const meta = STATE[state];
  return (
    <div
      className="border border-neutral-100 rounded-[10px] p-3.5 relative"
      style={{ background: state === 'running' ? '#f4f3ff55' : 'white' }}
    >
      <div className="flex items-start gap-2.5">
        <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center text-white">
          <Icon name="car" size={22} color="white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-[13.5px] font-extrabold font-mono text-neutral-900 tracking-[-0.01em]">
              {v.plate}
            </div>
            <StatusPill kind={meta.kind} label={meta.tag} dense />
          </div>
          <div className="text-[11.5px] text-neutral-500 mt-0.5">
            {v.model} · {v.color}
          </div>
        </div>
      </div>

      <div className="h-px bg-neutral-75 my-3" />

      {trip && (
        <div>
          <div className="flex items-center gap-1.5 text-[11.5px] text-neutral-500 font-semibold">
            <Icon name="clock" size={12} /> {trip.remaining} remaining
          </div>
          <div className="mt-2 text-[12.5px]">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
              <span className="text-neutral-700">{trip.from}</span>
            </div>
            <div className="w-px h-2 bg-neutral-200 ml-[2.5px]" />
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              <span className="text-neutral-800 font-semibold">{trip.to}</span>
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <Avatar name={trip.driver} size={22} />
            <span className="text-[12px] text-neutral-600">{trip.driver}</span>
          </div>
        </div>
      )}

      {!trip && next && (
        <div>
          <div className="text-[11.5px] text-neutral-500 font-semibold">Next trip</div>
          <div className="text-[13px] font-semibold text-neutral-800 mt-1">→ {next.to}</div>
          <div className="text-[12px] text-neutral-500 mt-0.5">at {next.at}</div>
          <div className="mt-2.5 flex items-center gap-2">
            <Avatar name={v.driver} size={22} />
            <span className="text-[12px] text-neutral-600">{v.driver}</span>
          </div>
        </div>
      )}

      {!trip && !next && detail && (
        <div className="text-[12px] text-neutral-600">{detail}</div>
      )}

      <div className="mt-3 flex justify-between text-[11px] text-neutral-400">
        <span>{v.km.toLocaleString()} km</span>
        <span>
          Oil in {v.nextOil > 0 ? `${v.nextOil} km` : `${Math.abs(v.nextOil)} km overdue`}
        </span>
      </div>
    </div>
  );
}
