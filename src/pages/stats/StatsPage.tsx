import { ChevronRight, Download } from "lucide-react";
import { Chart } from "../../components/Chart/Chart";
import { TimeDistribution } from "../../components/TimeDistribution/TimeDistribution";
import { csvCell, download } from "../../lib/import";
import { EVENTS, type EventId, type Session, type Solve } from "../../lib/model";
import { StatsRecords } from "../../components/StatsRecords/StatsRecords";
import type { Statistics } from "./useStatistics";

export function StatsPage({
  session, sessions, event, precision, timed, stats, setSelected, setEditing, showRecords,
}: {
  session: Session;
  sessions: Session[];
  event: EventId;
  precision: 2 | 3;
  timed: boolean;
  stats: Statistics;
  setSelected: (id: string) => void;
  setEditing: (solve: Solve) => void;
  showRecords: () => void;
}) {
  const {
    analysisSolves, statsRecords, statsRangeInvalid, measures, statsFormat, bestMulti,
    finite, best, mean, statsFrom, setStatsFrom, statsTo, setStatsTo,
    chartLimit, setChartLimit, chartEnd, setChartEnd, chartMetric, setChartMetric,
  } = stats;

  function exportCSV() {
    const rows = [
      [
        "date",
        "event",
        "time_ms",
        "penalty",
        "moves",
        "solved",
        "attempted",
        "scramble",
        "comment",
      ],
      ...analysisSolves.map((s) => [
        new Date(s.createdAt).toISOString(),
        s.event,
        s.ms,
        s.penalty,
        s.moves ?? "",
        s.solved ?? "",
        s.attempted ?? "",
        s.scramble,
        s.comment,
      ]),
    ];
    download(
      "split-records.csv",
      "\ufeff" +
        rows.map((row) => row.map(csvCell).join(",")).join("\n"),
      "text/csv;charset=utf-8",
    );
  }

  return (
    <main id="main-content" tabIndex={-1} className="page-content">
      <header className="page-heading">
        <div>
          <h1>統計</h1>
          <p className="muted">
            {EVENTS.find((e) => e[0] === event)![1]}
          </p>
        </div>
        <select
          aria-label="集計するセッション"
          value={session.id}
          onChange={(e) => setSelected(e.target.value)}
        >
          {sessions.map((s) => (
            <option value={s.id} key={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </header>
      <div className="stats-period" role="group" aria-label="集計期間">
        <label>
          開始日
          <input type="date" value={statsFrom} onChange={(e) => setStatsFrom(e.target.value)} />
        </label>
        <label>
          終了日
          <input type="date" value={statsTo} onChange={(e) => setStatsTo(e.target.value)}
            aria-invalid={statsRangeInvalid || undefined}
            aria-describedby={statsRangeInvalid ? "stats-period-error" : undefined} />
        </label>
        {(statsFrom || statsTo) && (
          <button onClick={() => { setStatsFrom(""); setStatsTo(""); }}>全期間に戻す</button>
        )}
        {statsRangeInvalid && (
          <p className="error-text" id="stats-period-error" role="alert">
            終了日は開始日以降を指定してください。
          </p>
        )}
      </div>
      <div className="summary-strip">
        <div>
          <span>記録数</span>
          <strong>{analysisSolves.length}</strong>
        </div>
        <div>
          <span>ベスト</span>
          <strong>
            {event === "333mbf"
              ? bestMulti
                ? `${2 * (bestMulti.solved ?? 0) - (bestMulti.attempted ?? 0)}点`
                : "—"
              : statsFormat(best)}
          </strong>
        </div>
        <div>
          <span>平均（DNFを除く）</span>
          <strong>
            {event === "333mbf"
              ? "—"
              : statsFormat(mean)}
          </strong>
        </div>
        <div>
          <span>DNF</span>
          <strong>
            {analysisSolves.filter((s) => s.penalty === "DNF").length}
          </strong>
        </div>
      </div>
      {event !== "333mbf" && (
        <table className="statistics-table">
          <thead>
            <tr>
              <th>指標</th>
              <th>現在</th>
              <th>ベスト</th>
            </tr>
          </thead>
          <tbody>
            {measures
              .filter((m) => event !== "333fm" || m.n === 3)
              .map((m) => (
                <tr key={m.n}>
                  <th>{m.n === 3 ? "Mean of 3" : `Average of ${m.n}`}</th>
                  <td>{statsFormat(m.current)}</td>
                  <td>{statsFormat(m.best)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
      {timed && (
        <div className="stats-visuals">
          <section className="stats-chart">
            <div className="panel-heading">
              <h2>タイムの推移</h2>
            </div>
            <div className="trend-controls">
              <label>
                表示する記録数
                <input type="number" min="1" max="1000000" inputMode="numeric"
                  value={chartLimit} onChange={(e) => setChartLimit(e.target.value)} />
              </label>
              <label>
                最後の記録番号
                <input type="number" min="1" max={Math.max(1, analysisSolves.length)} inputMode="numeric"
                  placeholder={String(analysisSolves.length)} value={chartEnd}
                  onChange={(e) => setChartEnd(e.target.value)} />
              </label>
              <label>
                推移
                <select value={chartMetric} onChange={(e) => setChartMetric(e.target.value as typeof chartMetric)}>
                  <option value="best">ベストタイム</option>
                  {[5, 12, 50, 100, 500, 1000].map((n) => (
                    <option key={n} value={`ao${n}`}>ao{n}</option>
                  ))}
                </select>
              </label>
            </div>
            <Chart solves={analysisSolves} large
              limit={Math.max(1, Math.min(1000000, Number(chartLimit) || 100))}
              end={chartEnd ? Math.min(analysisSolves.length, Math.max(1, Number(chartEnd) || analysisSolves.length)) : analysisSolves.length}
              metric={chartMetric} />
            <div className="chart-legend">
              <span><i />タイム</span>
              <span><i />{chartMetric === "best" ? "ベストタイム" : chartMetric}</span>
            </div>
          </section>
          <TimeDistribution times={finite} precision={precision} />
        </div>
      )}
      <div className="panel-heading">
        <h2>記録</h2>
        <div className="stats-record-actions">
          <button type="button" className="icon-button" aria-label="すべての記録を見る"
            title="すべての記録を見る" onClick={showRecords}>
            <ChevronRight size={19} aria-hidden="true" />
          </button>
          <button onClick={exportCSV}>
            <Download size={16} />
            CSV
          </button>
        </div>
      </div>
      <StatsRecords
        items={statsRecords.slice(0, 3)} className="stats-record-preview"
        hasDateRange={Boolean(statsFrom || statsTo)} event={event}
        precision={precision} setEditing={setEditing}
      />
    </main>
  );
}
