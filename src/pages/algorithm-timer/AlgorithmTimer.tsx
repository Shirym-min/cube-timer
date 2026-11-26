import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChartNoAxesCombined, Shuffle, Sparkles, Timer } from "lucide-react";
import library from "../../data/algorithm-library.json";
import { CasePattern, type AlgorithmCase, type AlgorithmSet } from "../../components/AlgorithmDetail";
import { TimerStage } from "../../components/TimerStage/TimerStage";
import { AlgorithmOverview, AlgorithmPatternResults } from "../../components/AlgorithmResults/AlgorithmResults";
import { effective, type Solve } from "../../lib/model";
import { analyzePractice, choosePracticePattern } from "../../lib/algorithmPractice";
import type { useStore } from "../../lib/useStore";
import type { useTimerSession } from "../timer/useTimerSession";
import { pageURL, type FollowPage } from "../../navigation";
import "./AlgorithmTimer.css";

type View = "timer" | "results" | "patterns";

export default function AlgorithmTimer({ store, timer, blocked, edit, focus, setFocus, followPage }: {
  store: ReturnType<typeof useStore>;
  timer: ReturnType<typeof useTimerSession>;
  blocked: boolean;
  edit: (s: Solve) => void;
  focus: boolean;
  setFocus: (focus: boolean) => void;
  followPage: FollowPage;
}) {
  const [set, setSet] = useState<AlgorithmSet>("PLL");
  const learningKey = `split-smart-practice:${store.storageScope}`;
  const [smart, setSmart] = useState(() => {
    try { return localStorage.getItem(learningKey) === "true"; } catch { return false; }
  });
  const [entry, setEntry] = useState(() => choosePracticePattern(
    library.PLL, undefined,
    smart ? analyzePractice(library.PLL, store.solves.filter(s => s.practice?.algorithm === "PLL")) : undefined,
  ));
  const [view, setView] = useState<View>("timer");
  const main = useRef<HTMLElement>(null);
  const previousView = useRef<View>(view);
  const [pending, setPending] = useState<Solve | null>(null);
  const locked = timer.locked || !!pending;
  const scramble = entry.variants[0].setup;
  const cases = library[set];
  const records = useMemo(() => store.solves.filter(s => s.practice?.algorithm === set), [store.solves, set]);
  const learning = useMemo(() => analyzePractice(cases, records), [cases, records]);
  const times = records.map(effective).filter(Number.isFinite);
  const best = times.length ? times.reduce((a, b) => Math.min(a, b)) : null;
  const precision = store.settings.precision;
  const resultProps = { set, cases, learning, precision, edit, startPractice };

  function startPractice(pattern: AlgorithmCase) {
    setEntry(pattern);
    setView("timer");
  }

  function toggleSmart() {
    const next = !smart;
    setSmart(next);
    try { localStorage.setItem(learningKey, String(next)); } catch { /* Continue for this visit. */ }
  }

  useLayoutEffect(() => {
    const previous = previousView.current;
    previousView.current = view;
    if (previous === view) return;
    main.current?.scrollTo(0, 0);
    window.scrollTo(0, 0);
    if (view === "timer") {
      main.current?.querySelector<HTMLElement>(".timer-touch")?.focus({ preventScroll: true });
    } else if (view === "patterns" || previous === "patterns") {
      main.current?.focus({ preventScroll: true });
    }
  }, [view]);

  async function save(s: Solve) {
    await store.commit("solve", s.id, s);
    setPending(null);
  }

  return <main ref={main} id="main-content" tabIndex={-1} className="page-content algorithm-timer" data-view={view}>
    <h1 className="sr-only">アルゴリズム計測</h1>
    <header className="timer-tabs algorithm-controls">
      {view === "patterns" ? (
        <button className="icon-button" type="button" aria-label="総合結果に戻る" title="総合結果に戻る" onClick={() => setView("results")}>
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
      ) : (
        <a className="action-link icon-button" href={locked ? undefined : pageURL("practice")}
          aria-disabled={locked || undefined} aria-label="ツールに戻る" title="ツールに戻る"
          onClick={(event) => followPage(event, "practice")}>
          <ArrowLeft size={18} aria-hidden="true" />
        </a>
      )}
      <div className="algorithm-view-switch" role="group" aria-label="表示切り替え">
        <button type="button" aria-label="計測" title="計測" disabled={locked} aria-pressed={view === "timer"}
          className={view === "timer" ? "selected" : ""} onClick={() => setView("timer")}>
          <Timer size={19} aria-hidden="true" />
        </button>
        <button type="button" aria-label="結果" title="結果" disabled={locked} aria-pressed={view !== "timer"}
          className={view !== "timer" ? "selected" : ""} onClick={() => setView("results")}>
          <ChartNoAxesCombined size={19} aria-hidden="true" />
        </button>
      </div>
      <div className="algorithm-options">
        <button type="button" className={smart ? "selected" : ""} title="スマート学習"
          aria-label="スマート学習" aria-pressed={smart} disabled={locked} onClick={toggleSmart}>
          <Sparkles size={18} aria-hidden="true" />
          <span className="learning-label" aria-hidden="true">スマート学習</span>
        </button>
        <select aria-label="アルゴリズム" value={set} disabled={locked} onChange={(event) => {
          const next = event.target.value as AlgorithmSet;
          const nextRecords = store.solves.filter(s => s.practice?.algorithm === next);
          setSet(next);
          setEntry(choosePracticePattern(library[next], undefined,
            smart ? analyzePractice(library[next], nextRecords) : undefined));
        }}>
          {Object.keys(library).map(name => <option key={name}>{name}</option>)}
        </select>
      </div>
    </header>
    {view === "results" && <AlgorithmOverview key={set} {...resultProps} records={records} openPatterns={() => setView("patterns")} />}
    {view === "patterns" && <AlgorithmPatternResults key={set} {...resultProps} />}
    {view === "timer" && <>
      <section className="algorithm-prompt" aria-label="出題パターン">
        <CasePattern key={scramble} setup={scramble} set={set} showHarrisBaum={false} />
        <div><h2>{entry.name}</h2><p translate="no">{scramble}</p></div>
        <button className="icon-button" aria-label="次のパターン" title="次のパターン" disabled={locked}
          onClick={() => setEntry(choosePracticePattern(cases, entry.name, smart ? learning : undefined))}><Shuffle size={18} /></button>
      </section>
      <TimerStage key={set} settings={{ ...store.settings, inspection: false }} event="333" enabled={!blocked && !pending}
        onPhase={timer.setTimerPhase} onFinish={(ms, penalty, splits) => {
          const result: Solve = { id: crypto.randomUUID(), sessionId: "algorithm-practice", event: "333",
            practice: { algorithm: set, pattern: entry.name }, ms, penalty, splits, scramble, comment: "", createdAt: Date.now() };
          setPending(result);
          setEntry(choosePracticePattern(cases, entry.name, smart ? analyzePractice(cases, [...records, result]) : undefined));
          void save(result).catch(() => {});
        }}
        pending={pending} retry={() => pending ? save(pending) : Promise.resolve()}
        latest={records.at(-1)} solves={records} best={best} patch={timer.patch} remove={timer.removeSolve}
        edit={edit} focus={focus} setFocus={setFocus} />
    </>}
  </main>;
}
