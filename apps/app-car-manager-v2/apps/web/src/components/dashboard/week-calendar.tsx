const DAYS = ['Mon 5', 'Tue 6', 'Wed 7', 'Thu 8', 'Fri 9', 'Sat 10', 'Sun 11'];
const HOURS = ['08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18'];

// [day(0-6), startHourRel, durationHrs, vehicleIdx, title, route]
const EVENTS: [number, number, number, number, string, string][] = [
  [0, 0.5, 2,   0, 'Park Joon-ho',  '→ Long An IZ'],
  [0, 4,   3.5, 1, 'Kim Min-seo',   '→ Bình Dương plant'],
  [1, 1,   2,   0, 'Park Joon-ho',  '→ District 7'],
  [1, 5.5, 2.5, 2, 'Choi Ji-woo',   '→ Vung Tau'],
  [2, 0.5, 2.5, 1, 'Nguyễn Thu Hà', '→ Vinhomes'],
  [2, 4,   2,   0, 'Park Joon-ho',  '→ Tan Son Nhat T2'],
  [3, 1.5, 4,   2, 'Kim Min-seo',   '→ Đồng Nai factory'],
  [4, 0,   1.5, 0, 'Lee Hyun-jung', '→ District 1'],
  [4, 3,   3,   1, 'Park Joon-ho',  '→ Cát Lái port'],
  [4, 7,   2,   2, 'Choi Ji-woo',   '→ Bến Thành'],
  [5, 1,   2.5, 0, 'Park Joon-ho',  '→ Phú Mỹ Hưng'],
];

const COLORS = [
  { bg: '#dbeafe', bd: '#3182f6', fg: '#1c3f88' },
  { bg: '#ebe9fe', bd: '#7a5af8', fg: '#5925dc' },
  { bg: '#ccfbf1', bd: '#14b8a6', fg: '#0f766e' },
] as const;

const HOUR_H = 36;
const TODAY_COL = 1;

export function WeekCalendar() {
  return (
    <div className="border-t border-neutral-100">
      <div
        className="grid border-b border-neutral-100 bg-neutral-25"
        style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}
      >
        <div />
        {DAYS.map((d, i) => {
          const isToday = i === TODAY_COL;
          return (
            <div
              key={i}
              className={`px-2.5 py-2 border-l border-neutral-100 text-[11.5px] font-bold ${
                isToday ? 'text-brand-700' : 'text-neutral-600'
              }`}
            >
              {d}
              {isToday && (
                <span className="ml-1.5 text-[10px] text-white bg-brand-500 px-1.5 py-px rounded-full font-bold">
                  TODAY
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="grid relative" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
        <div>
          {HOURS.map((h, i) => (
            <div
              key={i}
              className="text-[11px] text-neutral-400 pr-2 pt-[3px] text-right tabular"
              style={{ height: HOUR_H }}
            >
              {h}:00
            </div>
          ))}
        </div>
        {DAYS.map((_, col) => (
          <div key={col} className="border-l border-neutral-100 relative">
            {HOURS.map((_, r) => (
              <div
                key={r}
                style={{ height: HOUR_H }}
                className={r < HOURS.length - 1 ? 'border-b border-neutral-75' : ''}
              />
            ))}
            {EVENTS.filter((e) => e[0] === col).map((e, ei) => {
              const c = COLORS[e[3]]!;
              return (
                <div
                  key={ei}
                  className="absolute rounded-[5px] overflow-hidden"
                  style={{
                    left: 6,
                    right: 6,
                    top: e[1] * HOUR_H + 2,
                    height: e[2] * HOUR_H - 4,
                    background: c.bg,
                    borderLeft: `3px solid ${c.bd}`,
                    color: c.fg,
                    padding: '5px 7px',
                    fontSize: 11,
                  }}
                >
                  <div className="font-bold leading-tight text-[11.5px]">{e[4]}</div>
                  <div className="opacity-85 mt-0.5 leading-tight">{e[5]}</div>
                </div>
              );
            })}
            {col === TODAY_COL && (
              <div
                className="absolute left-0 right-0 border-t-2 border-danger-500"
                style={{ top: 4.5 * HOUR_H }}
              >
                <span className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-danger-500" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
