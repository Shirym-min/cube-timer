import { average, effective, formatTime, type Solve } from "../../lib/model";
export function Chart({
  solves,
  large = false,
  limit = 100,
  metric = "ao5",
  end = solves.length,
}: {
  solves: Solve[];
  large?: boolean;
  limit?: number;
  end?: number;
  metric?: "best" | "ao5" | "ao12" | "ao50" | "ao100" | "ao500" | "ao1000";
}) {
  const last = Math.min(solves.length, Math.max(0, end));
  const first = Math.max(0, last - limit);
  const rows = solves.slice(first, last),
    values = rows.map(effective),
    finite = values.filter(Number.isFinite);
  if (!finite.length)
    return (
      <div className={`chart-empty ${large ? "large" : ""}`}>
        <svg viewBox="0 0 400 100" aria-hidden="true">
          <path
            d="M0 75H400M0 40H400M0 5H400"
            stroke="currentColor"
            strokeDasharray="3 5"
            fill="none"
          />
        </svg>
        <span>記録するとグラフが表示されます</span>
      </div>
    );
  let best = Infinity;
  const windowSize = metric === "best" ? 0 : Number(metric.slice(2));
  const trend: (number | null)[] = [];
  for (let i = 0; i < last; i++) {
    best = Math.min(best, effective(solves[i]));
    if (i < first) continue;
    trend.push(metric === "best"
      ? (Number.isFinite(best) ? best : null)
      : average(solves.slice(Math.max(0, i + 1 - windowSize), i + 1), windowSize));
  }
  const plotted = [...finite, ...trend.filter((v): v is number => v !== null && Number.isFinite(v))];
  const low = Math.max(0, Math.min(...plotted) * 0.9),
    high = Math.max(...plotted) * 1.1 || 1000,
    w = 640,
    h = large ? 240 : 130;
  const x = (i: number) => 48 + (i * (w - 64)) / Math.max(1, rows.length - 1),
    y = (v: number) => 12 + ((high - v) / (high - low)) * (h - 40);
  const series = (vals: (number | null)[]) => {
    let d = "", pen = false;
    vals.forEach((v, i) => {
      if (v === null || !Number.isFinite(v)) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i)},${y(v)} `;
      pen = true;
    });
    return d;
  };
  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`${first + 1}回目から${last}回目のタイム推移。最小${formatTime(Math.min(...finite))}、最大${formatTime(Math.max(...finite))}`}
      >
        {[0, 0.5, 1].map((t) => {
          const v = low + (high - low) * t;
          return (
            <g key={t}>
              <line
                x1="48"
                x2={w - 12}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--line)"
                strokeDasharray="3 5"
              />
              <text x="0" y={y(v) + 4} fill="var(--muted)" fontSize="11">
                {(v / 1000).toFixed(1)}s
              </text>
            </g>
          );
        })}
        <path
          d={series(values)}
          fill="none"
          stroke="var(--accent-ink)"
          strokeOpacity=".35"
          strokeWidth="1.5"
        />
        <path
          d={series(trend)}
          fill="none"
          stroke="var(--accent-ink)"
          strokeWidth="2.5"
        />
        {values.map(
          (v, i) =>
            Number.isFinite(v) && (
              <circle
                key={rows[i].id}
                cx={x(i)}
                cy={y(v)}
                r="3"
                fill="var(--accent-ink)"
              >
                <title>
                  #{first + i + 1} {formatTime(v)}
                </title>
              </circle>
            ),
        )}
        <text x="48" y={h - 3} fill="var(--muted)" fontSize="11">
          {first + 1}
        </text>
        <text x={w - 25} y={h - 3} fill="var(--muted)" fontSize="11">
          {last}
        </text>
      </svg>
    </div>
  );
}
