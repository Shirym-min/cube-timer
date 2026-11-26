import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronRight, LayoutGrid, Timer, Trophy } from "lucide-react";
import { CasePattern, type AlgorithmCase, type AlgorithmSet } from "../AlgorithmDetail";
import { Chart } from "../Chart/Chart";
import { Modal } from "../Modal/Modal";
import { TimeDistribution } from "../TimeDistribution/TimeDistribution";
import { average, effective, formatResult, formatTime, type Settings, type Solve } from "../../lib/model";
import { median, type analyzePractice } from "../../lib/algorithmPractice";
import "./AlgorithmResults.css";

type ResultsProps = {
  set: AlgorithmSet;
  records: Solve[];
  precision: Settings["precision"];
  edit: (solve: Solve) => void;
};
type PracticeProps = Omit<ResultsProps, "records"> & {
  cases: AlgorithmCase[];
  learning: ReturnType<typeof analyzePractice>;
  startPractice: (pattern: AlgorithmCase) => void;
};

function meanOf(times: number[]) {
  return times.length ? times.reduce((sum, time) => sum + time, 0) / times.length : null;
}

function ResultDetails({ records, precision, edit, children }: Omit<ResultsProps, "set"> & { children: ReactNode }) {
  const times = records.map(effective).filter(Number.isFinite);
  const best = times.length ? times.reduce((a, b) => Math.min(a, b)) : null;

  return (
    <div className="algorithm-result-details">
      <dl className="algorithm-summary">
        <div><dt>記録数</dt><dd>{records.length}</dd></div>
        <div><dt>平均（DNFを除く）</dt><dd>{formatTime(meanOf(times), precision)}</dd></div>
        <div><dt>ベスト</dt><dd>{formatTime(best, precision)}</dd></div>
      </dl>
      {children}
      {records.length > 0 && (
        <>
          <section className="stats-chart">
            <div className="panel-heading"><h3>タイムの推移</h3></div>
            <Chart solves={records} />
          </section>
          <TimeDistribution times={times} precision={precision} />
          <section>
            <h3>計測記録</h3>
            <div className="algorithm-history">
              {records.slice().reverse().map((solve) => (
                <button key={solve.id} onClick={() => edit(solve)}>
                  <span>{solve.practice?.pattern}</span>
                  <strong>{formatResult(solve, precision)}</strong>
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export function AlgorithmOverview({ set, cases, learning, records, precision, edit, openPatterns, startPractice }: PracticeProps & {
  records: Solve[];
  openPatterns: () => void;
}) {
  const [active, setActive] = useState<AlgorithmCase>();
  return (
    <section className="algorithm-results">
      <div className="algorithm-results-heading">
        <h2>{set}の結果</h2>
        <button onClick={openPatterns}>
          <LayoutGrid size={17} aria-hidden="true" />パターン別<ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
      <ResultDetails records={records} precision={precision} edit={edit}>
        <section className="practice-weakness">
          <div className="panel-heading">
            <h3>苦手なパターン</h3>
            <span className="muted">{learning.practiced} / {cases.length}パターン練習済み</span>
          </div>
          {learning.weak.length > 0 ? (
            <ul>
              {learning.weak.slice(0, 5).map(({ name, dnf, attempts, median, slow }) => (
                <li key={name}>
                  <button type="button" aria-haspopup="dialog" onClick={() => setActive(cases.find(pattern => pattern.name === name))}>
                    <strong>{name}</strong>
                    <span>
                      {dnf >= 2 && <span>DNF {dnf}/{attempts}回</span>}
                      {slow && <span>中央値 {formatTime(median, precision)}（基準 {formatTime(learning.baseline, precision)}）</span>}
                    </span>
                    <ChevronRight size={15} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : <p>{learning.baseline === null ? "各パターンを3回以上計測すると、苦手なパターンを判定できます。" : "苦手と判定されたパターンはありません。"}</p>}
          <details>
            <summary>判定基準</summary>
            <p className="muted">各パターンの直近5回までを集計します。DNFが2回以上、またはタイムの中央値がセット内の基準より20%以上長いパターンを表示します。基準には、各パターンの中央値を並べたときの中央の値を使います。</p>
          </details>
        </section>
      </ResultDetails>
      {active && <PatternDialog set={set} active={active} records={learning.byPattern.get(active.name) ?? []}
        precision={precision} edit={edit} startPractice={startPractice} close={() => setActive(undefined)} />}
    </section>
  );
}

function PatternAnalysis({ records, precision, edit }: Omit<ResultsProps, "set">) {
  if (!records.length) return <p className="practice-pattern-empty muted">まだ計測記録がありません。</p>;

  const times = records.map(effective).filter(Number.isFinite).sort((a, b) => a - b);
  const best = times[0] ?? null;
  const metrics = [
    ["ベスト", formatTime(best, precision)],
    ["平均", formatTime(meanOf(times), precision)],
    ["中央値", formatTime(median(times), precision)],
    ["直近のao5", formatTime(average(records, 5), precision)],
    ["直近のao12", formatTime(average(records, 12), precision)],
    ["DNF", `${records.length - times.length} / ${records.length}`],
  ];

  return (
    <div className="algorithm-result-details">
      <dl className="algorithm-summary">
        {metrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      {times.length > 0 && (
        <section className="stats-chart">
          <div className="panel-heading"><h3>タイムの推移</h3></div>
          <Chart solves={records} />
          {records.length >= 5 && (
            <div className="chart-legend">
              <span><i aria-hidden="true" />タイム</span>
              <span><i aria-hidden="true" />ao5</span>
            </div>
          )}
        </section>
      )}
      <section className="practice-records">
        <div className="panel-heading"><h3>計測記録</h3><span className="muted">{records.length}件</span></div>
        <table>
          <thead><tr><th scope="col">#</th><th scope="col">日付</th><th scope="col">タイム</th></tr></thead>
          <tbody>
            {records.slice().reverse().map((solve, index) => (
              <tr key={solve.id}>
                <td>{records.length - index}</td>
                <td>{new Date(solve.createdAt).toLocaleDateString("ja-JP")}</td>
                <td>
                  <button type="button" onClick={() => edit(solve)}>
                    {best !== null && effective(solve) === best && <Trophy size={14} aria-label="ベスト" />}
                    {formatResult(solve, precision)}
                    <ChevronRight size={15} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function PatternDialog({ set, active, records, precision, edit, startPractice, close }: ResultsProps & {
  active: AlgorithmCase;
  startPractice: (pattern: AlgorithmCase) => void;
  close: () => void;
}) {
  return (
    <Modal title={active.name} onClose={close} wide className="practice-pattern-dialog">
      <div className="practice-pattern-dialog-intro">
        <div className="practice-pattern-thumbnail" aria-hidden="true">
          <CasePattern setup={active.variants[0].setup} set={set} showHarrisBaum={false} />
        </div>
        <button type="button" onClick={() => startPractice(active)}>
          <Timer size={17} aria-hidden="true" />このパターンを練習
        </button>
      </div>
      <PatternAnalysis records={records} precision={precision} edit={edit} />
    </Modal>
  );
}

export function AlgorithmPatternResults({ set, cases, learning, precision, edit, startPractice }: PracticeProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<AlgorithmCase>();
  const [visible, setVisible] = useState<ReadonlySet<string>>(() => new Set());
  const grid = useRef<HTMLUListElement>(null);
  const search = query.trim().toLowerCase();
  const matches = useMemo(() => cases.filter((entry) => entry.name.toLowerCase().includes(search)), [cases, search]);

  useEffect(() => {
    const observer = new IntersectionObserver((items) => {
      const names: string[] = [];
      for (const item of items) {
        if (!item.isIntersecting) continue;
        const name = (item.target as HTMLLIElement).dataset.pattern;
        if (name) names.push(name);
        observer.unobserve(item.target);
      }
      if (names.length) setVisible((previous) => new Set([...previous, ...names]));
    }, { rootMargin: "120px" });
    grid.current?.querySelectorAll("li[data-pattern]").forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [matches]);

  return (
    <section className="algorithm-results">
      <div className="algorithm-results-heading">
        <h2>{set}のパターン別平均</h2>
        {cases.length > 30 && (
          <input type="search" aria-label="パターン名を検索" placeholder="パターン名で検索"
            value={query} onChange={(event) => setQuery(event.target.value)} />
        )}
      </div>
      {matches.length === 0 && <p role="status">該当するパターンがありません。</p>}
      <ul ref={grid} className="practice-pattern-grid">
        {matches.map((entry) => {
          const mean = meanOf(learning.byPattern.get(entry.name)?.map(effective).filter(Number.isFinite) ?? []);
          return (
            <li key={entry.name} data-pattern={entry.name}>
              <button type="button" aria-haspopup="dialog" onClick={() => setActive(entry)}>
                <span className="practice-pattern-thumbnail" aria-hidden="true">
                  {visible.has(entry.name) && (
                    <CasePattern setup={entry.variants[0].setup} set={set} showHarrisBaum={false} />
                  )}
                </span>
                <span className="practice-pattern-name">{entry.name}</span>
                <strong>{formatTime(mean, precision)}</strong>
              </button>
            </li>
          );
        })}
      </ul>
      {active && <PatternDialog set={set} active={active} records={learning.byPattern.get(active.name) ?? []}
        precision={precision} edit={edit} startPractice={startPractice} close={() => setActive(undefined)} />}
    </section>
  );
}
