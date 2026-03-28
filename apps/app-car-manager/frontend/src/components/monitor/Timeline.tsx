import { clsx } from 'clsx';

interface TimelineEntry {
  plateNumber: string;
  vehicleModel: string;
  bars: TimelineBar[];
}

interface TimelineBar {
  startHour: number;
  endHour: number;
  label: string;
  status: 'running' | 'completed' | 'scheduled' | 'maintenance';
}

interface TimelineProps {
  entries: TimelineEntry[];
  startHour?: number;
  endHour?: number;
}

const HOURS_DEFAULT_START = 7;
const HOURS_DEFAULT_END = 19;

const barStyles: Record<string, string> = {
  running: 'bg-blue-600 text-white',
  completed: 'bg-green-600/20 text-green-700 border border-green-600/40',
  scheduled: 'bg-orange-500/15 text-orange-600 border border-orange-500/25',
  maintenance: 'bg-yellow-500/15 text-yellow-600 border border-yellow-500/30',
};

export function Timeline({
  entries,
  startHour = HOURS_DEFAULT_START,
  endHour = HOURS_DEFAULT_END,
}: TimelineProps) {
  const totalHours = endHour - startHour;
  const hours = Array.from({ length: totalHours + 1 }, (_, i) => startHour + i);

  return (
    <div className="overflow-x-auto pb-2">
      <div className="min-w-[700px] overflow-hidden rounded-[10px] border border-[#e2e5eb] bg-white">
        {/* Header */}
        <div
          className="grid border-b border-[#e2e5eb] bg-[#f0f2f5]"
          style={{ gridTemplateColumns: `160px repeat(${hours.length}, 1fr)` }}
        >
          <div className="border-r border-[#e2e5eb] px-3.5 py-2 text-left font-mono text-[10px] text-gray-400">
            차량
          </div>
          {hours.map((h) => (
            <div
              key={h}
              className="border-r border-[#e2e5eb] px-1.5 py-2 text-center font-mono text-[10px] text-gray-400"
            >
              {String(h).padStart(2, '0')}
            </div>
          ))}
        </div>

        {/* Rows */}
        {entries.map((entry, idx) => (
          <div
            key={idx}
            className={clsx(
              'grid min-h-[44px]',
              idx < entries.length - 1 && 'border-b border-[#e2e5eb]',
            )}
            style={{ gridTemplateColumns: '160px 1fr' }}
          >
            <div className="flex flex-col justify-center border-r border-[#e2e5eb] px-3.5 py-2.5">
              <div className="font-mono text-[12px] font-semibold text-gray-900">
                {entry.plateNumber}
              </div>
              <div className="text-[10px] text-gray-400">{entry.vehicleModel}</div>
            </div>
            <div className="relative px-1.5 py-2">
              {entry.bars.map((bar, barIdx) => {
                const left = ((bar.startHour - startHour) / totalHours) * 100;
                const width = ((bar.endHour - bar.startHour) / totalHours) * 100;
                return (
                  <div
                    key={barIdx}
                    className={clsx(
                      'absolute top-1/2 flex h-7 -translate-y-1/2 items-center overflow-hidden whitespace-nowrap rounded px-2 text-[10px] font-medium',
                      barStyles[bar.status],
                    )}
                    style={{ left: `${left}%`, width: `${width}%` }}
                  >
                    {bar.label}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
