// 8 weeks × 4 categories (Fuel, Repair, Meal, Oil), values in M VND
const WEEKS: { l: string; v: [number, number, number, number] }[] = [
  { l: 'Mar 16', v: [3.2, 1.8, 0.6, 0.2] },
  { l: 'Mar 23', v: [3.6, 0.9, 0.7, 0.0] },
  { l: 'Mar 30', v: [2.9, 2.1, 0.5, 0.4] },
  { l: 'Apr 6',  v: [3.4, 3.6, 0.8, 0.0] },
  { l: 'Apr 13', v: [4.1, 1.3, 1.0, 0.3] },
  { l: 'Apr 20', v: [3.7, 2.4, 0.6, 0.2] },
  { l: 'Apr 27', v: [3.9, 4.1, 0.9, 0.5] },
  { l: 'May 4',  v: [5.1, 3.2, 1.2, 0.4] },
];

const COLORS = ['#3182f6', '#7a5af8', '#f79009', '#14b8a6'];
const H = 200;

export function StackedSpend() {
  const max = Math.max(...WEEKS.map((w) => w.v.reduce((a, b) => a + b, 0)));
  return (
    <div
      className="flex items-end gap-3 pb-6 border-b border-neutral-75 relative"
      style={{ height: H }}
    >
      {WEEKS.map((w, i) => {
        const total = w.v.reduce((a, b) => a + b, 0);
        return (
          <div key={i} className="flex-1 flex flex-col items-center h-full justify-end relative">
            <div className="text-[10.5px] font-bold text-neutral-500 mb-1 tabular">
              {total.toFixed(1)}M
            </div>
            <div
              className="w-full rounded-t-[4px] overflow-hidden flex flex-col-reverse"
              style={{ height: (total / max) * (H - 50) }}
            >
              {w.v.map((v, j) => (
                <div
                  key={j}
                  style={{
                    height: `${(v / total) * 100}%`,
                    background: COLORS[j],
                  }}
                />
              ))}
            </div>
            <div className="text-[11px] text-neutral-500 mt-1.5 absolute bottom-0">{w.l}</div>
          </div>
        );
      })}
    </div>
  );
}
