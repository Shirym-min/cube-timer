import { useId } from "react";
import { formatTime, type Settings } from "../lib/model";
import { timeDistribution } from "../lib/timeDistribution";

const seconds = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 3 });

export function TimeDistribution({
  times,
  precision,
}: {
  times: readonly number[];
  precision: Settings["precision"];
}) {
  const heading = useId();
  const distribution = timeDistribution(times);

  return (
    <section className="stats-chart time-distribution" aria-labelledby={heading}>
      <div className="panel-heading">
        <h2 id={heading}>タイムの分布</h2>
        <span className="muted">{times.length.toLocaleString("ja-JP")}件（DNFを除く）</span>
      </div>
      {distribution ? (
        <DistributionDetails distribution={distribution} precision={precision} />
      ) : (
        <p className="muted">有効なタイムを記録すると分布が表示されます。</p>
      )}
    </section>
  );
}

function DistributionDetails({
  distribution,
  precision,
}: {
  distribution: NonNullable<ReturnType<typeof timeDistribution>>;
  precision: Settings["precision"];
}) {
  const { bins, curve, lower, upper, deviation, median, q1, q3, p90 } = distribution;
  const step = Math.max(1, Math.ceil(Math.max(...bins, ...curve) / 4));
  const top = Math.ceil(Math.max(...bins, ...curve) / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const width = 1000, height = 160, bin = width / bins.length;
  const y = (count: number) => height * (1 - count / top);
  const points = curve.map((count, i) => `${width * i / (curve.length - 1)},${y(count)}`).join(" ");
  const metrics = [
    ["標準偏差", deviation], ["中央値", median],
    ["第1四分位", q1], ["第3四分位", q3], ["90パーセンタイル", p90],
  ] as const;

  return (
    <>
      <dl className="distribution-metrics">
        {metrics.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{formatTime(value, precision)}</dd>
          </div>
        ))}
      </dl>
      <div className="distribution-axis-title muted">件数</div>
      <div className="distribution-chart">
        <div className="distribution-counts" aria-hidden="true">
          {[...ticks].reverse().map((tick) => <span key={tick}>{tick}</span>)}
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img"
          aria-label="タイム帯ごとの記録数を示すヒストグラム">
          <desc>
            {bins.map((count, i) => {
              const start = lower + i * (upper - lower) / bins.length;
              const end = lower + (i + 1) * (upper - lower) / bins.length;
              return `${seconds.format(start / 1000)}秒から${seconds.format(end / 1000)}秒は${count}件。`;
            }).join("")}
          </desc>
          {ticks.map((tick) => (
            <line key={tick} x1="0" x2={width} y1={y(tick)} y2={y(tick)}
              stroke="var(--line)" vectorEffect="non-scaling-stroke" />
          ))}
          {bins.map((count, i) => (
            <rect key={i} x={i * bin + 2} y={y(count)} width={bin - 4} height={height - y(count)}
              fill="var(--accent-ink)" fillOpacity="0.35" />
          ))}
          {curve.length > 0 && (
            <polyline points={points} fill="none" stroke="var(--text)" strokeWidth="2"
              strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        <div className="distribution-times" aria-hidden="true">
          {[lower, (lower + upper) / 2, upper].map((value) => (
            <span key={value}>{seconds.format(value / 1000)}秒</span>
          ))}
        </div>
      </div>
      <div className="chart-legend distribution-legend">
        <span><i aria-hidden="true" />実測</span>
        {curve.length > 0 && <span><i aria-hidden="true" />正規分布（近似）</span>}
      </div>
    </>
  );
}
